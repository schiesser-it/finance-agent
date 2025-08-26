import type { GenerationMode } from "../config.js";

import { DashboardArtifact } from "./DashboardArtifact";
import { NotebookArtifact } from "./NotebookArtifact";

export function createArtifact(mode: GenerationMode) {
  return mode === "notebook" ? new NotebookArtifact() : new DashboardArtifact();
}
