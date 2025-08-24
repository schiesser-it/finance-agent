import { spawn, spawnSync } from "node:child_process";
import { openSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { openExternalUrl } from "./browser.js";
import { ensureConfigDir, getLogsDir, getVenvDir, getInvocationCwd } from "./config.js";
import { isManagedProcessRunning, readManagedMeta, writeManagedMeta } from "./processLifecycle.js";

export interface JupyterPackagesConfig {
  packages: string[];
}

export interface JupyterServerMeta {
  pid: number;
  port: number;
  notebookDir: string;
}

export const NOTEBOOK_MODE = "notebook" as const;

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
  if (isManagedProcessRunning(NOTEBOOK_MODE)) {
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
  writeManagedMeta(NOTEBOOK_MODE, { pid: child.pid, port, notebookDir });

  // Let the UI know how to shutdown
  onMessage(`Jupyter started. Logs: ${outPath}. PID: ${child.pid}`);
}

export function getServerPort(): number {
  const meta = readManagedMeta(NOTEBOOK_MODE) as JupyterServerMeta | null;
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
