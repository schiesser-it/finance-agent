import { spawn, spawnSync } from "node:child_process";
import { openSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { openExternalUrl } from "../browser.js";
import { ClaudeResponse } from "../claudeService.js";
import {
  ensureConfigDir,
  getLogsDir,
  getVenvDir,
  getInvocationCwd,
  readThinkingModeFromConfig,
} from "../config.js";
import type { GenerationMode } from "../config.js";
import { isManagedProcessRunning, writeManagedMeta } from "../processLifecycle.js";
export const NOTEBOOK_FILE = "analysis.ipynb";

import type { Artifact } from "./types.js";

export class NotebookArtifact implements Artifact {
  mode: GenerationMode = "notebook";
  fileName = NOTEBOOK_FILE;

  async runProcess(opts?: { onMessage?: (line: string) => void }): Promise<void> {
    const onMessage = opts?.onMessage ?? (() => {});
    ensureConfigDir();
    const venvDir = getVenvDir();
    const envPort = Number(process.env.JUPYTER_PORT || "");
    const port = Number.isFinite(envPort) && envPort > 0 ? (envPort as number) : 8888;
    const notebookDir = getInvocationCwd();
    const logsDir = getLogsDir();
    const outPath = path.join(logsDir, "jupyter.out.log");
    const errPath = path.join(logsDir, "jupyter.err.log");

    try {
      const jupyterCheck = spawnSync("uv", ["run", "--python", venvDir, "jupyter", "--version"], {
        stdio: "ignore",
      });
      if (jupyterCheck.status !== 0) {
        throw new Error("Jupyter is not installed. Run setup first.");
      }
    } catch {
      throw new Error("Jupyter is not installed. Run setup first.");
    }

    if (!isManagedProcessRunning("notebook")) {
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
      writeManagedMeta("notebook", { pid: child.pid, port, notebookDir });
      onMessage(`Jupyter started. Logs: ${outPath}. PID: ${child.pid}`);
    } else {
      onMessage("Jupyter server already running.");
    }

    const url = `http://127.0.0.1:${port}/notebooks/${encodeURIComponent(this.fileName)}`;
    try {
      await openExternalUrl(url);
      onMessage(`Opening notebook in browser: ${url}`);
    } catch (e) {
      onMessage(`Failed to open browser: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  buildGeneratePrompt(userPrompt: string): string {
    const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
    const guidance =
      "Make sure to tell a story and add supporting visual pleasing graphs using plotly. " +
      "When using yfinance, auto_adjust=True is now the default. This means that 'Open', 'High', 'Low', and 'Close' columns are all automatically adjusted for stock splits and dividends. No need to use e.g. 'Adj Close' anymore. " +
      "When working with PDF, use PDF extractor tool to get the content or tabular data instead of `Read` tool.";
    const prefix = existsSync(notebookPath)
      ? `update the jupyter notebook named ${NOTEBOOK_FILE}. ${guidance}`
      : `create a jupyter notebook named ${NOTEBOOK_FILE}. ${guidance}`;
    const thinking = readThinkingModeFromConfig();
    let postfix = "";
    if (thinking === "normal") postfix = " think";
    if (thinking === "hard") postfix = " think hard";
    if (thinking === "harder") postfix = " think harder";
    return `${prefix} ${userPrompt}${postfix}`;
  }

  async fix(
    executePrompt: (
      prompt: string,
      options?: { echoPrompt?: boolean; useRawPrompt?: boolean },
    ) => Promise<ClaudeResponse>,
    opts?: { onMessage?: (line: string) => void },
  ): Promise<void> {
    const onMessage = opts?.onMessage ?? (() => {});
    try {
      const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
      if (!existsSync(notebookPath)) {
        onMessage(`No \`${NOTEBOOK_FILE}\` found. Run a prompt first to generate the notebook.`);
        return;
      }
      const raw = readFileSync(notebookPath, {
        encoding: "utf8",
      });
      const parsed: unknown = JSON.parse(raw);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cells: any[] = Array.isArray((parsed as any)?.cells)
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((parsed as any).cells as any[])
        : [];
      let latestTraceback: string[] | null = null;
      for (const cell of cells) {
        const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
        for (const output of outputs) {
          if (output && output.output_type === "error" && Array.isArray(output.traceback)) {
            latestTraceback = output.traceback as string[];
          }
        }
      }
      if (!latestTraceback || latestTraceback.length === 0) {
        onMessage(
          "No error traceback found in the notebook. Did you save the notebook with error?",
        );
        return;
      }
      const tracebackText = latestTraceback.join("\n");
      await executePrompt(`fix this error in the notebook ${NOTEBOOK_FILE}: ${tracebackText}`, {
        useRawPrompt: true,
      });
    } catch (e) {
      onMessage(`Failed to fix notebook: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
