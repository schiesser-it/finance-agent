import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { getConfigDir } from "./config.js";
import type { GenerationMode } from "./config.js";
import { waitForProcessExit } from "./venv.js";

export type ManagedMeta = {
  pid?: number;
  port?: number;
  cwd?: string;
  url?: string;
  // Allow arbitrary extra fields (e.g., notebookDir)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function getMetaFilePathForMode(mode: GenerationMode): string {
  const configDir = getConfigDir();
  return path.join(configDir, mode === "notebook" ? "jupyter.meta.json" : "dashboard.meta.json");
}

export function readManagedMeta(mode: GenerationMode): ManagedMeta | null {
  try {
    const metaFile = getMetaFilePathForMode(mode);
    if (!existsSync(metaFile)) return null;
    const raw = readFileSync(metaFile, { encoding: "utf8" });
    const meta = JSON.parse(raw) as ManagedMeta;
    return typeof meta?.pid === "number" ? meta : null;
  } catch {
    return null;
  }
}

export function writeManagedMeta(mode: GenerationMode, meta: ManagedMeta): void {
  const metaFile = getMetaFilePathForMode(mode);
  writeFileSync(metaFile, JSON.stringify(meta, null, 2), { encoding: "utf8" });
}

export function cleanupManagedMeta(mode: GenerationMode): void {
  const metaFile = getMetaFilePathForMode(mode);
  try {
    if (existsSync(metaFile)) unlinkSync(metaFile);
  } catch {
    // ignore
  }
}

export function isManagedProcessRunning(mode: GenerationMode): boolean {
  const meta = readManagedMeta(mode);
  const pid = meta?.pid;
  if (!pid || pid <= 0) return false;
  try {
    // Cross-platform-ish check
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function stopManagedProcess(
  mode: GenerationMode,
  opts?: { onMessage?: (line: string) => void },
): Promise<void> {
  const onMessage = opts?.onMessage ?? (() => {});
  const meta = readManagedMeta(mode);
  const pid = meta?.pid;
  if (!pid || pid <= 0) {
    onMessage(`No running ${mode} process found.`);
    cleanupManagedMeta(mode);
    return;
  }

  onMessage(`Stopping ${mode} process ...`);
  try {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore
    }
    const terminatedAfterTerm = await waitForProcessExit(pid, 5000);
    if (!terminatedAfterTerm) {
      onMessage("Process did not stop gracefully. Sending SIGKILL ...");
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
      const terminatedAfterKill = await waitForProcessExit(pid, 5000);
      if (!terminatedAfterKill) {
        onMessage(`❌ Failed to stop ${mode} process. You may need to terminate it manually.`);
        return;
      }
    }
    cleanupManagedMeta(mode);
    onMessage(`✅ ${mode} process stopped.`);
  } catch (e) {
    onMessage(`Error stopping ${mode} process: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function stopAllManagedProcesses(opts?: {
  onMessage?: (line: string) => void;
}): Promise<void> {
  const modes: GenerationMode[] = ["notebook", "dashboard"];
  for (const mode of modes) {
    try {
      await stopManagedProcess(mode, opts);
    } catch {
      // ignore individual stop errors; continue stopping others
    }
  }
}
