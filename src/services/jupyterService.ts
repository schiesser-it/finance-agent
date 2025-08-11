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
  getVenvJupyterPath,
  getVenvPipPath,
  getVenvPythonPath,
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

export function isVenvReady(): boolean {
  const pythonPath = getVenvPythonPath();
  const pipPath = getVenvPipPath();
  const jupyterPath = getVenvJupyterPath();
  // Consider the environment ready only if the venv exists AND jupyter is installed.
  return existsSync(pythonPath) && existsSync(pipPath) && existsSync(jupyterPath);
}

export async function ensureVenvAndPackages(opts?: {
  packages?: string[];
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  ensureConfigDir();
  const venvDir = getVenvDir();
  const pythonPath = getVenvPythonPath();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  if (!existsSync(pythonPath)) {
    onMessage(`Setting up Python venv at ${venvDir} ...`);
    const pythonExe = detectPythonExecutable();
    await runCommand(pythonExe.command, [...pythonExe.argsPrefix, "-m", "venv", venvDir], {
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
  const pipPath = getVenvPipPath();
  const pythonPath = getVenvPythonPath();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  if (!existsSync(pythonPath)) {
    throw new Error("Python venv is not installed. Restart the app to set it up.");
  }

  onMessage("Updating Python packages ...");
  const pipOnMessage = (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("Requirement already satisfied:")) continue;
      onMessage(line);
    }
  };
  // Ensure pip exists; some environments may not provision pip in venv by default
  if (!existsSync(pipPath)) {
    await runCommand(pythonPath, ["-m", "ensurepip", "--upgrade"], {
      onMessage: pipOnMessage,
      signal: opts?.signal,
    });
  }

  // Use python -m pip for better reliability on Windows
  await runCommand(pythonPath, ["-m", "pip", "install", "--upgrade", "pip"], {
    onMessage: pipOnMessage,
    signal: opts?.signal,
  });
  await runCommand(pythonPath, ["-m", "pip", "install", ...packages], {
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
  const jupyterPath = getVenvJupyterPath();
  const envPort = Number(process.env.JUPYTER_PORT || "");
  const port = opts?.port ?? (Number.isFinite(envPort) && envPort > 0 ? envPort : 8888);
  const notebookDir = opts?.notebookDir ?? process.cwd();
  const logsDir = getLogsDir();
  const outPath = path.join(logsDir, "jupyter.out.log");
  const errPath = path.join(logsDir, "jupyter.err.log");

  if (!existsSync(jupyterPath)) {
    throw new Error("Jupyter is not installed. Run setup first.");
  }

  // Already running check
  if (isServerRunning()) {
    onMessage("Jupyter server already running.");
    return;
  }

  onMessage(`Starting Jupyter Notebook on port ${port} ...`);

  const outFd = openSync(outPath, "a");
  const errFd = openSync(errPath, "a");

  const isWindows = os.platform() === "win32";
  const child = spawn(
    jupyterPath,
    [
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

function detectPythonExecutable(): { command: string; argsPrefix: string[] } {
  // On Windows prefer the Python launcher `py -3` if available.
  // Else try `python3`, then `python`.
  // As a final fallback, use Node's execPath (rarely useful).
  const platform = os.platform();
  if (platform === "win32") {
    try {
      const res = spawnSync("py", ["-3", "--version"], { stdio: "ignore" });
      if (res.status === 0) return { command: "py", argsPrefix: ["-3"] };
    } catch {
      // ignore
    }
    try {
      const res = spawnSync("python", ["--version"], { stdio: "ignore" });
      if (res.status === 0) return { command: "python", argsPrefix: [] };
    } catch {
      // ignore
    }
  }
  try {
    const res = spawnSync("python3", ["--version"], { stdio: "ignore" });
    if (res.status === 0) return { command: "python3", argsPrefix: [] };
  } catch {
    // ignore
  }
  try {
    const res = spawnSync("python", ["--version"], { stdio: "ignore" });
    if (res.status === 0) return { command: "python", argsPrefix: [] };
  } catch {
    // ignore
  }
  return { command: process.execPath, argsPrefix: [] };
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
