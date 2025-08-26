import type { GenerationMode } from "../config.js";

export interface Artifact {
  mode: GenerationMode;
  fileName: string;
  runProcess(opts?: {
    onMessage?: (line: string) => void;
    onTraceback?: (trace: string) => void;
  }): Promise<void>;
  buildGeneratePrompt(userPrompt: string): string;
}
