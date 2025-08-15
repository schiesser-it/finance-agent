import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { openExternalUrl } from "./browser.js";
import { getConfigDir, getVenvDir, ensureConfigDir, getInvocationCwd } from "./config.js";
import { pickAvailablePort, waitForPortOpen } from "./network.js";
import { ensureUvInstalled, waitForProcessExit, isPidAlive } from "./venv";

const DASHBOARD_META_FILE = path.join(getConfigDir(), "dashboard.meta.json");

export async function runDashboard(
  dashboardFile: string,
  opts?: { cwd?: string; onMessage?: (line: string) => void; openBrowser?: boolean; port?: number },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  const shouldOpenBrowser = opts?.openBrowser !== false;
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

    const cwd = opts?.cwd ?? getInvocationCwd();
    const port = await pickAvailablePort(opts?.port ?? 8501);
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
      writeFileSync(
        DASHBOARD_META_FILE,
        JSON.stringify(
          {
            pid: child.pid,
            command: `uv run --python ${venvDir} streamlit run ${dashboardFile} --server.port=${port}`,
            cwd,
            port,
            url: `http://localhost:${port}`,
          },
          null,
          2,
        ),
        { encoding: "utf8" },
      );
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
      try {
        if (existsSync(DASHBOARD_META_FILE)) unlinkSync(DASHBOARD_META_FILE);
      } catch {
        // ignore
      }
    });
  } catch (e) {
    onMessage(`Failed to launch dashboard: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function isDashboardRunning(): boolean {
  try {
    if (!existsSync(DASHBOARD_META_FILE)) return false;
    const raw = readFileSync(DASHBOARD_META_FILE, { encoding: "utf8" });
    const meta = JSON.parse(raw) as { pid?: number };
    if (!meta?.pid || meta.pid <= 0) return false;
    return isPidAlive(meta.pid);
  } catch {
    return false;
  }
}

export async function stopDashboard(opts?: { onMessage?: (line: string) => void }): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  try {
    if (!existsSync(DASHBOARD_META_FILE)) {
      onMessage("No running dashboard found.");
      return;
    }
    const raw = readFileSync(DASHBOARD_META_FILE, { encoding: "utf8" });
    const meta = JSON.parse(raw) as { pid?: number };
    const pid = meta?.pid;
    if (!pid || pid <= 0) {
      onMessage("No running dashboard found.");
      cleanupDashboardMeta();
      return;
    }
    onMessage("Stopping dashboard ...");
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
    const terminatedAfterTerm = await waitForProcessExit(pid, 5000);
    if (!terminatedAfterTerm) {
      onMessage("Dashboard did not stop gracefully. Sending SIGKILL ...");
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
      const terminatedAfterKill = await waitForProcessExit(pid, 5000);
      if (!terminatedAfterKill) {
        onMessage("❌ Failed to stop dashboard. You may need to terminate the process manually.");
        return;
      }
    }
    cleanupDashboardMeta();
    onMessage("✅ Dashboard stopped.");
  } catch (e) {
    onMessage(`Error stopping dashboard: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function cleanupDashboardMeta(): void {
  try {
    if (existsSync(DASHBOARD_META_FILE)) unlinkSync(DASHBOARD_META_FILE);
  } catch {
    // ignore
  }
}
