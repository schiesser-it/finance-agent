import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const CONFIG_DIR_NAME = ".finance-agent";

export function getConfigDir(): string {
  const homeDirectory = os.homedir();
  const configDirectory = path.join(homeDirectory, CONFIG_DIR_NAME);
  return configDirectory;
}

export function ensureConfigDir(): string {
  const configDirectory = getConfigDir();
  if (!existsSync(configDirectory)) {
    mkdirSync(configDirectory, { recursive: true });
  }
  return configDirectory;
}

export function getVenvDir(): string {
  return path.join(getConfigDir(), "venv");
}

export function getVenvBinDir(): string {
  // macOS/Linux layout
  return path.join(getVenvDir(), "bin");
}

export function getVenvPythonPath(): string {
  return path.join(getVenvBinDir(), "python");
}

export function getVenvPipPath(): string {
  return path.join(getVenvBinDir(), "pip");
}

export function getVenvJupyterPath(): string {
  return path.join(getVenvBinDir(), "jupyter");
}

export function getLogsDir(): string {
  const dir = path.join(getConfigDir(), "logs");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
