import type { GenerationMode } from "./config.js";
import { DASHBOARD_MODE, runDashboard } from "./dashboardService.js";
import { NOTEBOOK_MODE, openNotebookInBrowser, startServerInBackground } from "./jupyterService.js";
import { isManagedProcessRunning } from "./processLifecycle.js";
import { DASHBOARD_FILE, NOTEBOOK_FILE } from "./prompts.js";

export async function runProcess(
  mode: GenerationMode,
  opts?: { onMessage?: (line: string) => void; onTraceback?: (trace: string) => void },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});

  if (mode === "notebook") {
    if (!isManagedProcessRunning(NOTEBOOK_MODE)) {
      await startServerInBackground({ onMessage });
    }
    await openNotebookInBrowser(NOTEBOOK_FILE, { onMessage });
    return;
  }

  // dashboard mode
  if (!isManagedProcessRunning(DASHBOARD_MODE)) {
    const tbBuffer: string[] = [];
    let traceActive = false;
    const forward = (line: string) => {
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
    await runDashboard(DASHBOARD_FILE, { onMessage: forward });
  } else {
    onMessage("Dashboard server already running.");
  }
}
