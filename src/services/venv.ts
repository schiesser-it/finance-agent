import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";

import { ensureConfigDir, getVenvDir } from "./config.js";

const DEFAULT_PACKAGES: string[] = [
  "notebook",
  "pandas",
  "seaborn",
  "yfinance",
  "matplotlib",
  "scipy",
  "plotly",
  "streamlit",
  "watchdog",
  "feedparser",
];

export function getDefaultPackages(): string[] {
  return [...DEFAULT_PACKAGES];
}

function isUvAvailable(): boolean {
  try {
    const res = spawnSync("uv", ["--version"], { stdio: "ignore" });
    return res.status === 0;
  } catch {
    return false;
  }
}

export async function ensureUvInstalled(opts?: {
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  if (isUvAvailable()) {
    return; // Already installed
  }

  const onMessage = opts?.onMessage ?? (() => {});
  const platform = os.platform();

  onMessage("uv not found. Installing uv for faster Python environment management...");

  try {
    if (platform === "win32") {
      // For Windows, try to use the PowerShell installer
      await runCommand("powershell", ["-c", "irm https://astral.sh/uv/install.ps1 | iex"], {
        onMessage,
        signal: opts?.signal,
      });
    } else {
      // Try curl first, fallback to wget if curl is not available
      let installCommand: string;
      let installArgs: string[];

      try {
        const curlCheck = spawnSync("curl", ["--version"], { stdio: "ignore" });
        if (curlCheck.status === 0) {
          installCommand = "sh";
          installArgs = ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"];
        } else {
          throw new Error("curl not available");
        }
      } catch {
        try {
          const wgetCheck = spawnSync("wget", ["--version"], { stdio: "ignore" });
          if (wgetCheck.status === 0) {
            installCommand = "sh";
            installArgs = ["-c", "wget -qO- https://astral.sh/uv/install.sh | sh"];
          } else {
            throw new Error("Neither curl nor wget available");
          }
        } catch {
          throw new Error("Cannot install uv: neither curl nor wget is available");
        }
      }

      await runCommand(installCommand, installArgs, {
        onMessage,
        signal: opts?.signal,
      });
    }

    // Verify installation
    if (!isUvAvailable()) {
      throw new Error(
        "uv installation completed but uv is still not available. You may need to restart your terminal or add uv to your PATH.",
      );
    }

    onMessage("✅ uv installed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    onMessage(`❌ Failed to install uv: ${errorMsg}`);
    onMessage(
      "You can install uv manually by visiting: https://docs.astral.sh/uv/getting-started/installation/",
    );
    throw new Error(`uv installation failed: ${errorMsg}`);
  }
}

export function isVenvReady(): boolean {
  const venvDir = getVenvDir();
  if (!existsSync(venvDir)) {
    return false;
  }

  try {
    // Check if uv can find python in the venv and if jupyter is installed
    const pythonCheck = spawnSync("uv", ["run", "--python", venvDir, "python", "--version"], {
      stdio: "ignore",
    });
    const jupyterCheck = spawnSync("uv", ["run", "--python", venvDir, "jupyter", "--version"], {
      stdio: "ignore",
    });

    return pythonCheck.status === 0 && jupyterCheck.status === 0;
  } catch {
    return false;
  }
}

export async function ensureVenvAndPackages(opts?: {
  packages?: string[];
  onMessage?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  ensureConfigDir();
  const venvDir = getVenvDir();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  // Ensure uv is installed first
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  if (!existsSync(venvDir)) {
    onMessage(`Setting up Python venv at ${venvDir} using uv...`);
    await runCommand("uv", ["venv", venvDir], {
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
  const venvDir = getVenvDir();
  const packages = opts?.packages ?? DEFAULT_PACKAGES;
  const onMessage = opts?.onMessage ?? (() => {});

  if (!existsSync(venvDir)) {
    throw new Error("Python venv is not installed. Restart the app to set it up.");
  }

  // Ensure uv is available
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  onMessage("Updating Python packages using uv...");
  const pipOnMessage = (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("Requirement already satisfied:")) continue;
      onMessage(line);
    }
  };

  await runCommand("uv", ["pip", "install", "--python", venvDir, ...packages], {
    onMessage: pipOnMessage,
    signal: opts?.signal,
  });
}

export async function runInVenv(
  command: string,
  args: string[] = [],
  opts?: {
    cwd?: string;
    onMessage?: (line: string) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const venvDir = getVenvDir();
  await ensureUvInstalled({ onMessage: opts?.onMessage, signal: opts?.signal });

  await runCommand("uv", ["run", "--python", venvDir, command, ...args], opts);
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

export async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return !isPidAlive(pid);
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
