import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { openExternalUrl } from "../browser.js";
import { ClaudeResponse } from "../claudeService.js";
import type { GenerationMode } from "../config.js";
import {
  getVenvDir,
  ensureConfigDir,
  getInvocationCwd,
  readThinkingModeFromConfig,
} from "../config.js";
import { pickAvailablePort, waitForPortOpen } from "../network.js";
import {
  cleanupManagedMeta,
  isManagedProcessRunning,
  readManagedMeta,
  writeManagedMeta,
} from "../processLifecycle.js";
export const DASHBOARD_FILE = "dashboard.py";
import { ensureUvInstalled } from "../venv.js";

import type { Artifact } from "./types.js";

export class DashboardArtifact implements Artifact {
  mode: GenerationMode = "dashboard";
  fileName = DASHBOARD_FILE;

  async runProcess(opts?: {
    onMessage?: (line: string) => void;
    onTraceback?: (trace: string) => void;
  }): Promise<void> {
    const onMessage = opts?.onMessage ?? (() => {});
    const shouldOpenBrowser = true;
    await ensureUvInstalled({ onMessage });
    const venvDir = getVenvDir();
    const isWindows = os.platform() === "win32";
    try {
      try {
        const streamlitCheck = spawnSync(
          "uv",
          ["run", "--python", venvDir, "streamlit", "--version"],
          { stdio: "ignore" },
        );
        if (streamlitCheck.status !== 0) {
          throw new Error(
            "Streamlit is not installed. Please run the `/update` command to update your notebook environment with Streamlit.",
          );
        }
      } catch {
        throw new Error(
          "Streamlit is not installed. Please run the `/update` command to update your notebook environment with Streamlit.",
        );
      }

      if (!isManagedProcessRunning("dashboard")) {
        const cwd = getInvocationCwd();
        const port = await pickAvailablePort(8501);
        const child = spawn(
          "uv",
          [
            "run",
            "--python",
            venvDir,
            "streamlit",
            "run",
            this.fileName,
            `--server.port=${port}`,
            "--server.address=localhost",
            "--server.headless=true",
            "--browser.gatherUsageStats=false",
          ],
          {
            cwd,
            detached: false,
            windowsHide: isWindows,
            stdio: ["ignore", "pipe", "pipe"],
            env: {
              ...process.env,
              BROWSER: "none",
              STREAMLIT_SERVER_HEADLESS: "true",
              STREAMLIT_BROWSER_GATHER_USAGE_STATS: "false",
            },
          },
        );
        const tbBuffer: string[] = [];
        let traceActive = false;
        const forward = (d: unknown) => {
          const line = String(d).trim();
          onMessage(line);
          const l = line || "";
          if (!traceActive && l.includes("Traceback (most recent call last)")) {
            traceActive = true;
            tbBuffer.push(l);
            return;
          }
          if (traceActive) {
            tbBuffer.push(l);
            if (l.trim() === "" || /Error:|Exception:/i.test(l)) {
              const trace = tbBuffer.join("\n");
              traceActive = false;
              tbBuffer.length = 0;
              if (opts?.onTraceback) opts.onTraceback(trace);
            }
          }
        };
        child.stdout?.on("data", forward);
        child.stderr?.on("data", forward);
        try {
          ensureConfigDir();
          writeManagedMeta("dashboard", {
            pid: child.pid,
            command: `uv run --python ${venvDir} streamlit run ${this.fileName} --server.port=${port}`,
            cwd,
            port,
            url: `http://localhost:${port}`,
          });
        } catch (e) {
          onMessage(
            `Warning: Failed to write dashboard metadata: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        onMessage(`Launching dashboard: streamlit run ${this.fileName} (PID: ${child.pid})`);

        if (shouldOpenBrowser) {
          try {
            await waitForPortOpen(port, 15000);
            const url = `http://localhost:${port}`;
            onMessage(`Opening dashboard in browser: ${url}`);
            await openExternalUrl(url);
          } catch (e) {
            onMessage(`Failed to open browser: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        child.on("exit", (code, signal) => {
          onMessage(
            `Dashboard process exited${signal ? ` by signal ${signal}` : ` with code ${code ?? "unknown"}`}`,
          );
          cleanupManagedMeta("dashboard");
        });
      } else {
        const meta = readManagedMeta("dashboard");
        const url: string | undefined = (meta as { url?: string } | null)?.url;
        if (url) {
          try {
            onMessage(`Opening dashboard in browser: ${url}`);
            await openExternalUrl(url);
          } catch (e) {
            onMessage(`Failed to open browser: ${e instanceof Error ? e.message : String(e)}`);
          }
        } else {
          onMessage("Dashboard server already running.");
        }
      }
    } catch (e) {
      onMessage(`Failed to launch dashboard: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  buildGeneratePrompt(userPrompt: string): string {
    const guidance =
      "Use Plotly for charts. Ensure a professional Streamlit layout with header, optional KPI row with trend arrows (green up for positive, red down for negative), a grid of up to four best charts, and a concluding summary. Keep card heights uniform and show two decimal places for trends. " +
      "When using yfinance, auto_adjust=True is now the default. This means that 'Open', 'High', 'Low', and 'Close' columns are all automatically adjusted for stock splits and dividends. No need to use e.g. 'Adj Close' anymore. " +
      "When working with PDF, use PDF extractor tool to get the content or tabular data instead of `Read` tool.";
    const prefix = existsSync(path.resolve(getInvocationCwd(), DASHBOARD_FILE))
      ? `update the Streamlit dashboard named ${DASHBOARD_FILE}. ${guidance}`
      : `create a Streamlit dashboard named ${DASHBOARD_FILE}. ${guidance}`;
    const thinking = readThinkingModeFromConfig();
    let postfix = "";
    if (thinking === "normal") postfix = " think";
    if (thinking === "hard") postfix = " think hard";
    if (thinking === "harder") postfix = " think harder";
    return `${prefix} ${userPrompt}${postfix}`;
  }

  async fix(
    _executePrompt: (
      prompt: string,
      options?: { echoPrompt?: boolean; useRawPrompt?: boolean },
    ) => Promise<ClaudeResponse>,
    opts?: { onMessage?: (line: string) => void },
  ): Promise<void> {
    const onMessage = opts?.onMessage ?? (() => {});
    onMessage("The /fix command is not available in dashboard mode at the moment.");
  }
}
