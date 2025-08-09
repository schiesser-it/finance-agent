import { spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync, openSync, closeSync, unlinkSync, readSync } from "node:fs";
import path from "node:path";

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

const DEFAULT_PACKAGES: string[] = ["notebook", "pandas", "seaborn", "yfinance", "matplotlib"];

const SERVER_PID_FILE = path.join(getConfigDir(), "jupyter.pid");

export function getDefaultPackages(): string[] {
  return [...DEFAULT_PACKAGES];
}

export function isVenvReady(): boolean {
  const pythonPath = getVenvPythonPath();
  const pipPath = getVenvPipPath();
  return existsSync(pythonPath) && existsSync(pipPath);
}

export async function ensureVenvAndPackages(opts?: {
  packages?: string[];
  onMessage?: (line: string) => void;
}): Promise<void> {
  ensureConfigDir();
  const venvDir = getVenvDir();
  const pythonPath = getVenvPythonPath();
  const pipPath = getVenvPipPath();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  if (!existsSync(pythonPath)) {
    onMessage(`Setting up Python venv at ${venvDir} ...`);
    const pythonExe = detectPythonExecutable();
    await runCommand(pythonExe, ["-m", "venv", venvDir], { onMessage });
  }

  onMessage("Installing/updating required Python packages ...");
  const pipOnMessage = (chunk: string) => {
    // Split to handle multi-line chunks from stdout/stderr
    for (const line of chunk.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("Requirement already satisfied:")) continue;
      onMessage(line);
    }
  };
  await runCommand(pipPath, ["install", "--upgrade", "pip"], { onMessage: pipOnMessage });
  await runCommand(pipPath, ["install", ...packages], { onMessage: pipOnMessage });
}

export function isServerRunning(): boolean {
  if (!existsSync(SERVER_PID_FILE)) return false;
  try {
    const pid = Number(readTextFile(SERVER_PID_FILE).trim());
    if (!pid) return false;
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
  const port = opts?.port ?? 8888;
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

  const child = spawn(
    jupyterPath,
    [
      "notebook",
      //   "--no-browser",
      "--ip=127.0.0.1",
      `--port=${port}`,
      `--NotebookApp.notebook_dir=${notebookDir}`,
      "--NotebookApp.token=",
      "--NotebookApp.password=",
    ],
    {
      detached: true,
      stdio: ["ignore", outFd, errFd],
    },
  );

  child.unref();
  writeFileSync(SERVER_PID_FILE, String(child.pid));

  // Let the UI know how to shutdown
  onMessage(`Jupyter started. Logs: ${outPath}. PID: ${child.pid}`);
}

export async function stopServer(opts?: { onMessage?: (line: string) => void }): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  if (!existsSync(SERVER_PID_FILE)) {
    onMessage("No running Jupyter server found.");
    return;
  }
  const pidText = readTextFile(SERVER_PID_FILE).trim();
  const pid = Number(pidText);
  if (!pid) {
    onMessage("Invalid PID file. Cleaning up.");
    try {
      unlinkSync(SERVER_PID_FILE);
    } catch {
      // ignore
    }
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

    try {
      unlinkSync(SERVER_PID_FILE);
    } catch {
      // ignore
    }
    onMessage("✅ Jupyter server stopped.");
  } catch (e) {
    onMessage(`Error stopping server: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function readTextFile(p: string): string {
  const fd = openSync(p, "r");
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const bytesRead = readSync(fd, buffer, 0, buffer.length, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

async function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; onMessage?: (line: string) => void },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => onMessage(String(d).trim()));
    child.stderr.on("data", (d) => onMessage(String(d).trim()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function detectPythonExecutable(): string {
  // Prefer system python3 if available, else node's process.execPath
  try {
    const res = spawnSync("python3", ["--version"], { stdio: "ignore" });
    if (res.status === 0) return "python3";
  } catch {
    // ignore
  }
  return process.execPath;
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
