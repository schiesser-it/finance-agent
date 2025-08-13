import { spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync, openSync, unlinkSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { openExternalUrl } from "./browser.js";
import {
  ensureConfigDir,
  getConfigDir,
  getLogsDir,
  getVenvDir,
  getInvocationCwd,
} from "./config.js";

export interface JupyterPackagesConfig {
  packages: string[];
}

export interface JupyterServerMeta {
  pid: number;
  port: number;
  notebookDir: string;
}

const DEFAULT_PACKAGES: string[] = [
  "notebook",
  "pandas",
  "seaborn",
  "yfinance",
  "matplotlib",
  "scipy",
  "plotly",
];

const SERVER_META_FILE = path.join(getConfigDir(), "jupyter.meta.json");

export function getDefaultPackages(): string[] {
  return [...DEFAULT_PACKAGES];
}

function isUvAvailable(): boolean {
  try {
    const res = spawnSync("uv", ["--version"], { stdio: "ignore" });
    return res.status === 0;
  } catch {
    return false;
  }
}

export async function ensureUvInstalled(opts?: {
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  if (isUvAvailable()) {
    return; // Already installed
  }

  const onMessage = opts?.onMessage ?? (() => {});
  const platform = os.platform();

  onMessage("uv not found. Installing uv for faster Python environment management...");

  try {
    if (platform === "win32") {
      // For Windows, try to use the PowerShell installer
      await runCommand("powershell", ["-c", "irm https://astral.sh/uv/install.ps1 | iex"], {
        onMessage,
        signal: opts?.signal,
      });
    } else {
      // Try curl first, fallback to wget if curl is not available
      let installCommand: string;
      let installArgs: string[];

      try {
        const curlCheck = spawnSync("curl", ["--version"], { stdio: "ignore" });
        if (curlCheck.status === 0) {
          installCommand = "sh";
          installArgs = ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"];
        } else {
          throw new Error("curl not available");
        }
      } catch {
        try {
          const wgetCheck = spawnSync("wget", ["--version"], { stdio: "ignore" });
          if (wgetCheck.status === 0) {
            installCommand = "sh";
            installArgs = ["-c", "wget -qO- https://astral.sh/uv/install.sh | sh"];
          } else {
            throw new Error("Neither curl nor wget available");
          }
        } catch {
          throw new Error("Cannot install uv: neither curl nor wget is available");
        }
      }

      await runCommand(installCommand, installArgs, {
        onMessage,
        signal: opts?.signal,
      });
    }

    // Verify installation
    if (!isUvAvailable()) {
      throw new Error(
        "uv installation completed but uv is still not available. You may need to restart your terminal or add uv to your PATH.",
      );
    }

    onMessage("✅ uv installed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onMessage(`❌ Failed to install uv: ${errorMsg}`);
    onMessage(
      "You can install uv manually by visiting: https://docs.astral.sh/uv/getting-started/installation/",
    );
    throw new Error(`uv installation failed: ${errorMsg}`);
  }
}

export function isVenvReady(): boolean {
  const venvDir = getVenvDir();
  if (!existsSync(venvDir)) {
    return false;
  }

  try {
    // Check if uv can find python in the venv and if jupyter is installed
    const pythonCheck = spawnSync("uv", ["run", "--python", venvDir, "python", "--version"], {
      stdio: "ignore",
    });
    const jupyterCheck = spawnSync("uv", ["run", "--python", venvDir, "jupyter", "--version"], {
      stdio: "ignore",
    });

    return pythonCheck.status === 0 && jupyterCheck.status === 0;
  } catch {
    return false;
  }
}

export async function ensureVenvAndPackages(opts?: {
  packages?: string[];
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  ensureConfigDir();
  const venvDir = getVenvDir();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  // Ensure uv is installed first
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  if (!existsSync(venvDir)) {
    onMessage(`Setting up Python venv at ${venvDir} using uv...`);
    await runCommand("uv", ["venv", venvDir], {
      onMessage,
      signal: opts?.signal,
    });
  }

  await updateVenvPackages({ packages, onMessage, signal: opts?.signal });
}

export async function updateVenvPackages(opts?: {
  packages?: string[];
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const venvDir = getVenvDir();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  if (!existsSync(venvDir)) {
    throw new Error("Python venv is not installed. Restart the app to set it up.");
  }

  // Ensure uv is available
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  onMessage("Updating Python packages using uv...");
  const pipOnMessage = (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("Requirement already satisfied:")) continue;
      onMessage(line);
    }
  };

  await runCommand("uv", ["pip", "install", "--python", venvDir, ...packages], {
    onMessage: pipOnMessage,
    signal: opts?.signal,
  });
}

export function isServerRunning(): boolean {
  const meta = readServerMeta();
  const pid = meta?.pid;
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function startServerInBackground(opts?: {
  port?: number;
  notebookDir?: string;
  onMessage?: (line: string) => void;
}): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  ensureConfigDir();
  const venvDir = getVenvDir();
  const envPort = Number(process.env.JUPYTER_PORT || "");
  const port = opts?.port ?? (Number.isFinite(envPort) && envPort > 0 ? envPort : 8888);
  const notebookDir = opts?.notebookDir ?? getInvocationCwd();
  const logsDir = getLogsDir();
  const outPath = path.join(logsDir, "jupyter.out.log");
  const errPath = path.join(logsDir, "jupyter.err.log");

  // Check if jupyter is available in the venv
  try {
    const jupyterCheck = spawnSync("uv", ["run", "--python", venvDir, "jupyter", "--version"], {
      stdio: "ignore",
    });
    if (jupyterCheck.status !== 0) {
      throw new Error("Jupyter is not installed in the virtual environment.");
    }
  } catch {
    throw new Error("Jupyter is not installed. Run setup first.");
  }

  // Already running check
  if (isServerRunning()) {
    onMessage("Jupyter server already running.");
    return;
  }

  onMessage(`Starting Jupyter Notebook on port ${port}, serving files from ${notebookDir} ...`);

  const outFd = openSync(outPath, "a");
  const errFd = openSync(errPath, "a");

  const isWindows = os.platform() === "win32";
  const child = spawn(
    "uv",
    [
      "run",
      "--python",
      venvDir,
      "jupyter",
      "notebook",
      // Keep browser disabled here; we'll explicitly open URLs when needed
      "--no-browser",
      "--ip=127.0.0.1",
      `--port=${port}`,
      `--NotebookApp.notebook_dir=${notebookDir}`,
      "--NotebookApp.token=",
      "--NotebookApp.password=",
    ],
    {
      detached: !isWindows,
      windowsHide: isWindows,
      stdio: ["ignore", outFd, errFd],
    },
  );

  if (!isWindows) {
    child.unref();
  }
  writeFileSync(SERVER_META_FILE, JSON.stringify({ pid: child.pid, port, notebookDir }, null, 2), {
    encoding: "utf8",
  });

  // Let the UI know how to shutdown
  onMessage(`Jupyter started. Logs: ${outPath}. PID: ${child.pid}`);
}

export async function stopServer(opts?: { onMessage?: (line: string) => void }): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  const meta = readServerMeta();
  const pid = meta?.pid;
  if (!pid || pid <= 0) {
    onMessage("No running Jupyter server found.");
    cleanupMetaFile();
    return;
  }
  onMessage("Stopping Jupyter server ...");
  try {
    // Send SIGTERM and wait up to 5s
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }

    const terminatedAfterTerm = await waitForProcessExit(pid, 5000);
    if (!terminatedAfterTerm) {
      onMessage("Server did not stop gracefully. Sending SIGKILL ...");
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
      const terminatedAfterKill = await waitForProcessExit(pid, 5000);
      if (!terminatedAfterKill) {
        onMessage("❌ Failed to stop Jupyter server. Check processes and logs.");
        return;
      }
    }

    cleanupMetaFile();
    onMessage("✅ Jupyter server stopped.");
  } catch (e) {
    onMessage(`Error stopping server: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function getServerPort(): number {
  const meta = readServerMeta();
  if (meta?.port && meta.port > 0) return meta.port;
  const envPort = Number(process.env.JUPYTER_PORT || "");
  if (Number.isFinite(envPort) && envPort > 0) return envPort as number;
  return 8888;
}

export async function openNotebookInBrowser(
  notebookFilename: string,
  opts?: {
    onMessage?: (line: string) => void;
  },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  const port = getServerPort();
  const url = `http://127.0.0.1:${port}/notebooks/${encodeURIComponent(notebookFilename)}`;

  try {
    await openExternalUrl(url);
    onMessage(`Opening notebook in browser: ${url}`);
  } catch (e) {
    onMessage(`Failed to open browser: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function readServerMeta(): JupyterServerMeta | null {
  try {
    if (!existsSync(SERVER_META_FILE)) return null;
    const metaRaw = readFileSync(SERVER_META_FILE, { encoding: "utf8" });
    const meta = JSON.parse(metaRaw) as JupyterServerMeta;
    if (typeof meta.pid === "number" && typeof meta.port === "number") return meta;
  } catch {
    // ignore
  }
  return null;
}

function cleanupMetaFile(): void {
  try {
    if (existsSync(SERVER_META_FILE)) unlinkSync(SERVER_META_FILE);
  } catch {
    // ignore
  }
}

export async function runInVenv(
  command: string,
  args: string[] = [],
  opts?: {
    cwd?: string;
    onMessage?: (line: string) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const venvDir = getVenvDir();
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  await runCommand("uv", ["run", "--python", venvDir, command, ...args], opts);
}

async function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; onMessage?: (line: string) => void; signal?: AbortSignal },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let aborted = false;
    const onAbort = () => {
      aborted = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
    };
    if (opts?.signal) {
      if (opts.signal.aborted) onAbort();
      opts.signal.addEventListener("abort", onAbort);
    }
    child.stdout.on("data", (d) => onMessage(String(d).trim()));
    child.stderr.on("data", (d) => onMessage(String(d).trim()));
    child.on("error", (err) => {
      if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
      if (aborted) {
        reject(new Error("aborted"));
        return;
      }
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return !isPidAlive(pid);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
