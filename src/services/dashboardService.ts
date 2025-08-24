import { spawn, spawnSync } from "node:child_process";
import os from "node:os";

import { openExternalUrl } from "./browser.js";
import { getVenvDir, ensureConfigDir, getInvocationCwd } from "./config.js";
import { pickAvailablePort, waitForPortOpen } from "./network.js";
import { cleanupManagedMeta, writeManagedMeta } from "./processLifecycle.js";
import { ensureUvInstalled } from "./venv";

export const DASHBOARD_MODE = "dashboard" as const;

export async function runDashboard(
  dashboardFile: string,
  opts?: { onMessage?: (line: string) => void },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  const shouldOpenBrowser = true;
  await ensureUvInstalled({ onMessage });
  const venvDir = getVenvDir();
  const isWindows = os.platform() === "win32";
  try {
    // Ensure streamlit is available in the venv
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
        dashboardFile,
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
    child.stdout?.on("data", (d) => onMessage(String(d).trim()));
    child.stderr?.on("data", (d) => onMessage(String(d).trim()));
    try {
      ensureConfigDir();
      writeManagedMeta(DASHBOARD_MODE, {
        pid: child.pid,
        command: `uv run --python ${venvDir} streamlit run ${dashboardFile} --server.port=${port}`,
        cwd,
        port,
        url: `http://localhost:${port}`,
      });
    } catch (e) {
      onMessage(
        `Warning: Failed to write dashboard metadata: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
    onMessage(`Launching dashboard: streamlit run ${dashboardFile} (PID: ${child.pid})`);
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
        `Dashboard process exited${
          signal ? ` by signal ${signal}` : ` with code ${code ?? "unknown"}`
        }`,
      );
      cleanupManagedMeta(DASHBOARD_MODE);
    });
  } catch (e) {
    onMessage(`Failed to launch dashboard: ${e instanceof Error ? e.message : String(e)}`);
  }
}
