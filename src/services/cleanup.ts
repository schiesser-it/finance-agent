import { existsSync } from "node:fs";

import { createArtifact } from "./artifacts/factory.js";
import { readGenerationModeFromConfig, type GenerationMode } from "./config.js";

/**
 * Generate consistent cleanup warning messages
 */
export function getCleanupWarningMessage(mode: GenerationMode): string[] {
  const artifactType = mode === "notebook" ? "Jupyter notebook" : "dashboard";
  return [
    `⚠️  A ${artifactType} file already exists.`,
    `   Run /reset to delete it and start fresh or /open to open it.`,
  ];
}

/**
 * Check if the current mode has an existing file that would conflict
 */
export function checkForExistingFile(mode?: GenerationMode): {
  exists: boolean;
  mode: GenerationMode;
} {
  const currentMode = mode || readGenerationModeFromConfig();
  const artifact = createArtifact(currentMode);
  const exists = existsSync(artifact.getFilePath());

  return { exists, mode: currentMode };
}
