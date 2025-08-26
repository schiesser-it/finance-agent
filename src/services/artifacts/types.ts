import { ClaudeResponse } from "../claudeService.js";
import type { GenerationMode } from "../config.js";

export interface Artifact {
  mode: GenerationMode;
  fileName: string;
  getFilePath(): string;
  runProcess(opts?: {
    onMessage?: (line: string) => void;
    onTraceback?: (trace: string) => void;
  }): Promise<void>;
  buildGeneratePrompt(userPrompt: string): string;
  fix(
    executePrompt: (
      prompt: string,
      options?: { echoPrompt?: boolean; useRawPrompt?: boolean },
    ) => Promise<ClaudeResponse>,
    opts?: { onMessage?: (line: string) => void },
  ): Promise<void>;
}
