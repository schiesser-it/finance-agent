import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

// ---- Anthropic API key helpers ----

export function getAnthropicApiKeyFilePath(): string {
  return path.join(getConfigDir(), "anthropic_api_key");
}

export function readAnthropicApiKeyFromConfig(): string | undefined {
  try {
    const keyFile = getAnthropicApiKeyFilePath();
    if (!existsSync(keyFile)) {
      return undefined;
    }
    const raw = readFileSync(keyFile, { encoding: "utf-8" });
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function writeAnthropicApiKeyToConfig(apiKey: string): void {
  ensureConfigDir();
  const keyFile = getAnthropicApiKeyFilePath();
  writeFileSync(keyFile, `${apiKey.trim()}\n`, { encoding: "utf-8" });
}

export function ensureAnthropicApiKeyEnvFromConfig(): void {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "") {
    const fromConfig = readAnthropicApiKeyFromConfig();
    if (fromConfig) {
      process.env.ANTHROPIC_API_KEY = fromConfig;
    }
  }
}

export function setAnthropicApiKeyForSessionAndPersist(apiKey: string): void {
  writeAnthropicApiKeyToConfig(apiKey);
  process.env.ANTHROPIC_API_KEY = apiKey.trim();
}
