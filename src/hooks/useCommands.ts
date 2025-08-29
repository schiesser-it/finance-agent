import { existsSync, unlinkSync } from "node:fs";

import { useApp } from "ink";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";

import { buildConversionPrompt } from "../services/artifacts/converter.js";
import { createArtifact } from "../services/artifacts/factory.js";
import type { Artifact } from "../services/artifacts/types.js";
import { getCleanupWarningMessage, checkForExistingFile } from "../services/cleanup.js";
import { ClaudeService } from "../services/claudeService.js";
import type { ClaudeResponse } from "../services/claudeService.js";
import { COMMANDS } from "../services/commands.js";
import {
  readSelectedModelFromConfig,
  resolveModelId,
  writeSelectedModelToConfig,
  readThinkingModeFromConfig,
  writeThinkingModeToConfig,
  readGenerationModeFromConfig,
  writeGenerationModeToConfig,
  GenerationMode,
} from "../services/config.js";
import { getDefaultPackages, updateVenvPackages } from "../services/venv.js";

type RunningCommand = "execute" | "login" | "examples" | "confirm" | null;
type PendingAction =
  | { kind: "convert"; from: GenerationMode; to: GenerationMode }
  | { kind: "auto-fix-error" }
  | null;

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [runningCommand, setRunningCommand] = useState<RunningCommand>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = useMemo(() => {
    const padWidth = Math.max(...COMMANDS.map((c) => c.name.length), 10);
    return COMMANDS.map((c) => `${c.name.padEnd(padWidth)} - ${c.description}`);
  }, []);

  const [currentMode, setCurrentMode] = useState(readGenerationModeFromConfig());
  const artifactRef = useRef<Artifact>(createArtifact(currentMode));
  if (artifactRef.current.mode !== currentMode) {
    artifactRef.current = createArtifact(currentMode);
  }

  // Show cleanup warning on startup if file exists
  useEffect(() => {
    const { exists, mode } = checkForExistingFile();
    if (exists) {
      const warningMessages = getCleanupWarningMessage(mode);
      setOutput(warningMessages);
    }
  }, []);

  const executePrompt = useCallback(
    async (
      prompt: string,
      options?: {
        echoPrompt?: boolean;
        useRawPrompt?: boolean;
      },
    ): Promise<ClaudeResponse> => {
      // Allow executePrompt to run from confirmation flow as well
      if (runningCommand && runningCommand !== "examples" && runningCommand !== "confirm") {
        return { success: false, error: "Another command is already running" };
      }

      setRunningCommand("execute");
      if (options?.echoPrompt !== false) {
        setOutput((prev) => [...prev, `> ${prompt}`]);
      }
      const calculatedPrompt = options?.useRawPrompt
        ? prompt
        : artifactRef.current.buildGeneratePrompt(prompt);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await ClaudeService.executePrompt(calculatedPrompt, {
          abortController,
          onMessage: (message: string) => {
            setOutput((prev) => [...prev, message]);
          },
        });

        if (!response.success && response.error) {
          if (response.error.includes("aborted") || response.error.includes("cancelled")) {
            setOutput((prev) => [...prev, "⚠️  Operation cancelled by user"]);
          } else {
            setOutput((prev) => [...prev, `Error: ${response.error}`]);
          }
        } else if (response.success) {
          const mode = currentMode;
          try {
            await artifactRef.current.runProcess({
              onMessage: (line) => setOutput((prev) => [...prev, line]),
              onTraceback: () => {
                setPendingAction({ kind: "auto-fix-error" });
                setRunningCommand("confirm");
              },
            });
          } catch (e) {
            setOutput((prev) => [
              ...prev,
              `Failed to open ${mode}: ${e instanceof Error ? e.message : String(e)}`,
            ]);
          }
        }

        return response;
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((error as any).name === "AbortError" || (error as any).message?.includes("aborted")) {
          setOutput((prev) => [...prev, "⚠️  Operation cancelled by user"]);
        } else {
          setOutput((prev) => [
            ...prev,
            `Error: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      } finally {
        setRunningCommand(null);
        abortControllerRef.current = null;
      }
    },
    [runningCommand, currentMode],
  );

  const handleCommand = useCallback(
    async (command: string) => {
      setOutput((prev) => [...prev, `> ${command}`]);
      if (command === "/help") {
        setOutput((prev) => [...prev, "Available commands:", ...availableCommands]);
        return;
      }

      if (command === "/update") {
        setOutput((prev) => [...prev, "Updating environment packages ..."]);
        try {
          await updateVenvPackages({
            packages: getDefaultPackages(),
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
          setOutput((prev) => [...prev, "✅ Packages updated."]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error updating packages: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/reset") {
        const fileToDelete = artifactRef.current.fileName;
        const filePath = artifactRef.current.getFilePath();

        try {
          if (existsSync(filePath)) {
            unlinkSync(filePath);
            setOutput((prev) => [
              ...prev,
              `Removed \`${fileToDelete}\`. Next run will create a fresh ${currentMode}.`,
            ]);
          } else {
            setOutput((prev) => [...prev, `No \`${fileToDelete}\` found. Nothing to remove.`]);
          }
          // ensure that we start a new conversation
          ClaudeService.startNewConversation();
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error removing \`${fileToDelete}\`: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/fix") {
        try {
          await artifactRef.current.fix(executePrompt, {
            onMessage: (l) => setOutput((prev) => [...prev, l]),
          });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to fix: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }
      if (command === "/quit") {
        exit();
        return;
      }

      if (command === "/login") {
        setRunningCommand("login");
        return;
      }

      if (command.startsWith("/model")) {
        const [, arg] = command.split(/\s+/, 2);
        if (!arg) {
          const current = readSelectedModelFromConfig();
          setOutput((prev) => [
            ...prev,
            `Current model: ${current}`,
            "Available models:",
            "1. Claude Opus 4.1 - claude-opus-4-1-20250805 (alias: opus)",
            "2. Claude Sonnet 4 - claude-sonnet-4-20250514 (alias: sonnet)",
            "Use: /model <opus|sonnet|model-id>",
          ]);
          return;
        }
        try {
          const resolved = resolveModelId(arg);
          if (!resolved) {
            setOutput((prev) => [
              ...prev,
              `Unknown model: ${arg}`,
              "Use one of: opus, sonnet, claude-opus-4-1-20250805, claude-sonnet-4-20250514",
            ]);
            return;
          }
          writeSelectedModelToConfig(resolved);
          const current = readSelectedModelFromConfig();
          setOutput((prev) => [...prev, `✅ Model set to: ${current}`]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to set model: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command.startsWith("/thinking")) {
        const [, arg] = command.split(/\s+/, 2);
        if (!arg) {
          const current = readThinkingModeFromConfig();
          setOutput((prev) => [
            ...prev,
            `Current thinking mode: ${current}`,
            "Available modes:",
            "1. none",
            "2. normal",
            "3. hard",
            "4. harder",
            "Use: /thinking <none|normal|hard|harder>",
          ]);
          return;
        }
        const normalized = arg.trim().toLowerCase();
        if (!["none", "normal", "hard", "harder"].includes(normalized)) {
          setOutput((prev) => [
            ...prev,
            `Unknown thinking mode: ${arg}`,
            "Use one of: none, normal, hard, harder",
          ]);
          return;
        }
        try {
          writeThinkingModeToConfig(normalized as "none" | "normal" | "hard" | "harder");
          const current = readThinkingModeFromConfig();
          setOutput((prev) => [...prev, `✅ Thinking mode set to: ${current}`]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to set thinking mode: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command.startsWith("/mode")) {
        const [, arg] = command.split(/\s+/, 2);
        if (!arg) {
          setOutput((prev) => [
            ...prev,
            `Current generation mode: ${currentMode}`,
            "Available modes:",
            "1. notebook",
            "2. dashboard",
            "Use: /mode <notebook|dashboard>",
          ]);
          return;
        }
        const nextMode: GenerationMode = arg.trim().toLowerCase() as GenerationMode;
        if (!["notebook", "dashboard"].includes(nextMode)) {
          setOutput((prev) => [...prev, `Unknown mode: ${arg}`, "Use one of: notebook, dashboard"]);
          return;
        }
        try {
          // If switching, ask for conversion
          if (nextMode === currentMode) {
            setOutput((prev) => [...prev, `Mode already set to: ${currentMode}`]);
            return;
          }
          const currentArtifactExists = existsSync(artifactRef.current.getFilePath());
          const nextArtifact = createArtifact(nextMode);
          const nextArtifactExists = existsSync(nextArtifact.getFilePath());

          // Decide on conversion
          if (currentArtifactExists) {
            setPendingAction({ kind: "convert", from: currentMode, to: nextMode });
            setRunningCommand("confirm");
          }
          writeGenerationModeToConfig(nextMode);
          setCurrentMode(nextMode);
          setOutput((prev) => [...prev, `✅ Mode set to: ${nextMode}`]);

          // Show cleanup warning if destination file exists and no conversion is triggered
          if (nextArtifactExists && !currentArtifactExists) {
            const warningMessages = getCleanupWarningMessage(nextMode);
            setOutput((prev) => [...prev, ...warningMessages]);
          }
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to set mode: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/open") {
        const mode = currentMode;
        try {
          await artifactRef.current.runProcess({
            onMessage: (line: string) => {
              setOutput((prev) => [...prev, line]);
            },
          });
          setOutput((prev) => [
            ...prev,
            `✅ ${mode === "notebook" ? "Notebook" : "Dashboard"} opened successfully.`,
          ]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to open ${mode}: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/examples") {
        setRunningCommand("examples");
        return;
      }

      setOutput((prev) => [...prev, "Unknown command. Type /help for available commands."]);
    },
    [exit, availableCommands, executePrompt, currentMode],
  );

  const appendOutput = useCallback((lines: string | string[]) => {
    setOutput((prev) => [...prev, ...(Array.isArray(lines) ? lines : [lines])]);
  }, []);

  const abortExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setRunningCommand(null);
  }, []);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingAction) {
      setRunningCommand(null);
      return;
    }
    try {
      if (pendingAction && pendingAction.kind === "convert") {
        // Ensure destination file does not exist before converting
        try {
          const destinationArtifact = createArtifact(pendingAction.to);
          const destinationPath = destinationArtifact.getFilePath();
          if (existsSync(destinationPath)) {
            unlinkSync(destinationPath);
            setOutput((prev) => [
              ...prev,
              `Removed existing \`${destinationArtifact.fileName}\` before conversion.`,
            ]);
          }
        } catch (e) {
          setOutput((prev) => [
            ...prev,
            `Warning: Failed to ensure clean destination before conversion: ${
              e instanceof Error ? e.message : String(e)
            }`,
          ]);
        }
        const response = await executePrompt(
          buildConversionPrompt(pendingAction.from, pendingAction.to),
          {
            echoPrompt: false,
            useRawPrompt: true,
          },
        );
        if (response.success) {
          setOutput((prev) => [
            ...prev,
            `✅ Converted ${pendingAction.from} to ${pendingAction.to}.`,
          ]);
        } else {
          setOutput((prev) => [...prev, `Conversion failed: ${response.error ?? "Unknown error"}`]);
        }
      } else if (pendingAction && pendingAction.kind === "auto-fix-error") {
        await artifactRef.current.fix(executePrompt, {
          onMessage: (l) => setOutput((prev) => [...prev, l]),
        });
      }
    } finally {
      setPendingAction(null);
      setRunningCommand(null);
    }
  }, [pendingAction, executePrompt]);

  const cancelPendingAction = useCallback(() => {
    if (pendingAction) {
      setOutput((prev) => [...prev, "Conversion cancelled."]);
    }
    setPendingAction(null);
    setRunningCommand(null);
  }, [pendingAction]);

  return {
    output,
    handleCommand,
    executePrompt,
    abortExecution,
    appendOutput,
    runningCommand,
    confirmPendingAction,
    cancelPendingAction,
    pendingAction,
  };
};
