import type { GenerationMode } from "./config.js";
import { DASHBOARD_MODE, runDashboard } from "./dashboardService.js";
import { NOTEBOOK_MODE, openNotebookInBrowser, startServerInBackground } from "./jupyterService.js";
import { isManagedProcessRunning } from "./processLifecycle.js";
import { DASHBOARD_FILE, NOTEBOOK_FILE } from "./prompts.js";

export async function runProcess(
  mode: GenerationMode,
  opts?: { onMessage?: (line: string) => void },
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
    await runDashboard(DASHBOARD_FILE, { onMessage });
  } else {
    onMessage("Dashboard server already running.");
  }
}
