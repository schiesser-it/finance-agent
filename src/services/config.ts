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
  // On Windows, virtualenv places executables in `Scripts`, elsewhere it's `bin`
  const isWindows = os.platform() === "win32";
  return path.join(getVenvDir(), isWindows ? "Scripts" : "bin");
}

export function getVenvPythonPath(): string {
  const isWindows = os.platform() === "win32";
  return path.join(getVenvBinDir(), isWindows ? "python.exe" : "python");
}

export function getVenvPipPath(): string {
  const isWindows = os.platform() === "win32";
  return path.join(getVenvBinDir(), isWindows ? "pip.exe" : "pip");
}

export function getVenvJupyterPath(): string {
  const isWindows = os.platform() === "win32";
  return path.join(getVenvBinDir(), isWindows ? "jupyter.exe" : "jupyter");
}

export function getLogsDir(): string {
  const dir = path.join(getConfigDir(), "logs");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ---- Working directory resolution ----
// Some environments (global installs, certain shells) can cause process.cwd()
// to point at the package install directory instead of the user's current dir.
// Prefer POSIX PWD, then process.cwd().
export function getInvocationCwd(): string {
  const pwd = process.env.PWD?.trim();
  if (pwd && pwd.length > 0) {
    return pwd;
  }
  return process.cwd();
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

// ---- Model selection helpers ----

export interface ModelOption {
  key: string;
  label: string;
  id: string;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { key: "opus", label: "Claude Opus 4.1", id: "claude-opus-4-1-20250805" },
  { key: "sonnet", label: "Claude Sonnet 4", id: "claude-sonnet-4-20250514" },
];

export const DEFAULT_MODEL_ID = MODEL_OPTIONS[1].id;

export function getModelConfigFilePath(): string {
  return path.join(getConfigDir(), "model");
}

export function writeSelectedModelToConfig(modelId: string): void {
  ensureConfigDir();
  const filePath = getModelConfigFilePath();
  writeFileSync(filePath, `${modelId.trim()}\n`, { encoding: "utf-8" });
}

export function readSelectedModelFromConfig(): string {
  try {
    const filePath = getModelConfigFilePath();
    if (!existsSync(filePath)) {
      return DEFAULT_MODEL_ID;
    }
    const raw = readFileSync(filePath, { encoding: "utf-8" }).trim();
    const resolved = resolveModelId(raw);
    return resolved ?? DEFAULT_MODEL_ID;
  } catch {
    return DEFAULT_MODEL_ID;
  }
}

export function resolveModelId(input: string): string | undefined {
  const normalized = input.trim().toLowerCase();
  // Match by key alias
  const byKey = MODEL_OPTIONS.find((m) => m.key.toLowerCase() === normalized);
  if (byKey) return byKey.id;
  // Match by full id
  const byId = MODEL_OPTIONS.find((m) => m.id.toLowerCase() === normalized);
  if (byId) return byId.id;
  return undefined;
}

// ---- Thinking mode helpers ----

export type ThinkingMode = "none" | "normal" | "hard" | "harder";

export const DEFAULT_THINKING_MODE: ThinkingMode = "none";

export function getThinkingConfigFilePath(): string {
  return path.join(getConfigDir(), "thinking");
}

export function writeThinkingModeToConfig(mode: ThinkingMode): void {
  ensureConfigDir();
  const filePath = getThinkingConfigFilePath();
  writeFileSync(filePath, `${mode}\n`, { encoding: "utf-8" });
}

export function readThinkingModeFromConfig(): ThinkingMode {
  try {
    const filePath = getThinkingConfigFilePath();
    if (!existsSync(filePath)) {
      return DEFAULT_THINKING_MODE;
    }
    const raw = readFileSync(filePath, { encoding: "utf-8" }).trim().toLowerCase();
    if (raw === "none" || raw === "normal" || raw === "hard" || raw === "harder") {
      return raw as ThinkingMode;
    }
    return DEFAULT_THINKING_MODE;
  } catch {
    return DEFAULT_THINKING_MODE;
  }
}

// ---- Conversation session helpers ----

export function getSessionConfigFilePath(): string {
  return path.join(getConfigDir(), "session");
}

export function writeSessionIdToConfig(sessionId: string): void {
  ensureConfigDir();
  const filePath = getSessionConfigFilePath();
  writeFileSync(filePath, `${sessionId.trim()}\n`, { encoding: "utf-8" });
}

export function readSessionIdFromConfig(): string | undefined {
  try {
    const filePath = getSessionConfigFilePath();
    if (!existsSync(filePath)) {
      return undefined;
    }
    const raw = readFileSync(filePath, { encoding: "utf-8" });
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export function clearSessionFromConfig(): void {
  try {
    const filePath = getSessionConfigFilePath();
    if (existsSync(filePath)) {
      writeFileSync(filePath, "", { encoding: "utf-8" });
    }
  } catch {
    // Ignore errors when clearing session
  }
}
