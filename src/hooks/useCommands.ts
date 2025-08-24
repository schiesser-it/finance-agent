import { existsSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";

import { useApp } from "ink";
import { useState, useCallback, useRef, useMemo } from "react";

import { ClaudeService } from "../services/claudeService.js";
import type { ClaudeResponse } from "../services/claudeService.js";
import { COMMANDS } from "../services/commands.js";
import {
  readSelectedModelFromConfig,
  resolveModelId,
  writeSelectedModelToConfig,
  getInvocationCwd,
  readThinkingModeFromConfig,
  writeThinkingModeToConfig,
  readGenerationModeFromConfig,
  writeGenerationModeToConfig,
} from "../services/config.js";
import {
  buildPromptWithNotebookPrefix,
  DASHBOARD_FILE,
  NOTEBOOK_FILE,
  buildPromptWithDashboardPrefix,
  buildNotebookToDashboardPrompt,
  buildDashboardToNotebookPrompt,
} from "../services/prompts.js";
import { runProcess } from "../services/runner.js";
import { getDefaultPackages, updateVenvPackages } from "../services/venv.js";

type RunningCommand = "execute" | "login" | "examples" | "confirm" | null;

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [runningCommand, setRunningCommand] = useState<RunningCommand>(null);
  const [pendingConversion, setPendingConversion] = useState<
    "notebook-to-dashboard" | "dashboard-to-notebook" | null
  >(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = useMemo(() => {
    const padWidth = Math.max(...COMMANDS.map((c) => c.name.length), 10);
    return COMMANDS.map((c) => `${c.name.padEnd(padWidth)} - ${c.description}`);
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
      const mode = readGenerationModeFromConfig();
      const calculatedPrompt = options?.useRawPrompt
        ? prompt
        : mode === "dashboard"
          ? buildPromptWithDashboardPrefix(prompt)
          : buildPromptWithNotebookPrefix(prompt);

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
          const mode = readGenerationModeFromConfig();
          await runProcess(mode, {
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
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
    [runningCommand],
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
        const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
        try {
          if (existsSync(notebookPath)) {
            unlinkSync(notebookPath);
            setOutput((prev) => [
              ...prev,
              `Removed \`${NOTEBOOK_FILE}\`. Next run will create a fresh notebook.`,
            ]);
          } else {
            setOutput((prev) => [...prev, `No \`${NOTEBOOK_FILE}\` found. Nothing to remove.`]);
          }
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error removing \`${NOTEBOOK_FILE}\`: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/fix") {
        const mode = readGenerationModeFromConfig();
        if (mode !== "notebook") {
          setOutput((prev) => [
            ...prev,
            "The /fix command is only available in notebook mode at the moment.",
          ]);
          return;
        }
        const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
        try {
          if (!existsSync(notebookPath)) {
            setOutput((prev) => [
              ...prev,
              `No \`${NOTEBOOK_FILE}\` found. Run a prompt first to generate the notebook.`,
            ]);
            return;
          }

          const notebookRaw = readFileSync(notebookPath, { encoding: "utf8" });
          const notebookJson: unknown = JSON.parse(notebookRaw);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type NotebookCell = { outputs?: Array<any> };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cells: NotebookCell[] = Array.isArray((notebookJson as any)?.cells)
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((notebookJson as any).cells as NotebookCell[])
            : [];

          let latestTraceback: string[] | null = null;
          for (const cell of cells) {
            const outputs = Array.isArray(cell.outputs) ? cell.outputs : [];
            for (const output of outputs) {
              if (output && output.output_type === "error" && Array.isArray(output.traceback)) {
                latestTraceback = output.traceback as string[];
              }
            }
          }

          if (!latestTraceback || latestTraceback.length === 0) {
            setOutput((prev) => [
              ...prev,
              "No error traceback found in the notebook. Did you save the notebook with error?",
            ]);
            return;
          }

          const tracebackText = latestTraceback.join("\n");
          executePrompt(`fix this error in the notebook ${NOTEBOOK_FILE}: ${tracebackText}`, {
            useRawPrompt: true,
          });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to read or parse \`${NOTEBOOK_FILE}\`: ${error instanceof Error ? error.message : String(error)}`,
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
        const currentMode = readGenerationModeFromConfig();
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
        const normalized = arg.trim().toLowerCase();
        if (!["notebook", "dashboard"].includes(normalized)) {
          setOutput((prev) => [...prev, `Unknown mode: ${arg}`, "Use one of: notebook, dashboard"]);
          return;
        }
        try {
          // If switching, ask for conversion
          const nextMode = normalized as "notebook" | "dashboard";
          if (nextMode === currentMode) {
            setOutput((prev) => [...prev, `Mode already set to: ${currentMode}`]);
            return;
          }
          writeGenerationModeToConfig(nextMode);
          const now = readGenerationModeFromConfig();
          setOutput((prev) => [...prev, `✅ Mode set to: ${now}`]);

          // Decide on conversion
          const cwd = getInvocationCwd();
          const notebookExists = existsSync(path.resolve(cwd, NOTEBOOK_FILE));
          const dashboardExists = existsSync(path.resolve(cwd, DASHBOARD_FILE));
          if (now === "dashboard" && notebookExists) {
            setPendingConversion("notebook-to-dashboard");
            setRunningCommand("confirm");
          } else if (now === "notebook" && dashboardExists) {
            setPendingConversion("dashboard-to-notebook");
            setRunningCommand("confirm");
          }
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Failed to set mode: ${error instanceof Error ? error.message : String(error)}`,
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
    [exit, availableCommands, executePrompt],
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

  const confirmPendingConversion = useCallback(async () => {
    if (!pendingConversion) {
      setRunningCommand(null);
      return;
    }
    try {
      if (pendingConversion === "notebook-to-dashboard") {
        const response = await executePrompt(buildNotebookToDashboardPrompt(), {
          echoPrompt: false,
          useRawPrompt: true,
        });
        if (response.success) {
          setOutput((prev) => [...prev, `✅ Dashboard generated: \`${DASHBOARD_FILE}\`.`]);
        } else {
          setOutput((prev) => [...prev, `Conversion failed: ${response.error ?? "Unknown error"}`]);
        }
      } else if (pendingConversion === "dashboard-to-notebook") {
        const response = await executePrompt(buildDashboardToNotebookPrompt(), {
          echoPrompt: false,
          useRawPrompt: true,
        });
        if (response.success) {
          setOutput((prev) => [...prev, `✅ Notebook generated: \`${NOTEBOOK_FILE}\`.`]);
        } else {
          setOutput((prev) => [...prev, `Conversion failed: ${response.error ?? "Unknown error"}`]);
        }
      }
    } finally {
      setPendingConversion(null);
      setRunningCommand(null);
    }
  }, [pendingConversion, executePrompt]);

  const cancelPendingConversion = useCallback(() => {
    if (pendingConversion) {
      setOutput((prev) => [...prev, "Conversion cancelled."]);
    }
    setPendingConversion(null);
    setRunningCommand(null);
  }, [pendingConversion]);

  return {
    output,
    handleCommand,
    executePrompt,
    abortExecution,
    appendOutput,
    runningCommand,
    confirmPendingConversion,
    cancelPendingConversion,
    pendingConversion,
  };
};
