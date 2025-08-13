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
import { waitForProcessExit } from "./venv.js";

export interface JupyterPackagesConfig {
  packages: string[];
}

export interface JupyterServerMeta {
  pid: number;
  port: number;
  notebookDir: string;
}

const SERVER_META_FILE = path.join(getConfigDir(), "jupyter.meta.json");

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
