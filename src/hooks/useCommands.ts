import { existsSync, unlinkSync, readFileSync } from "node:fs";
import path from "node:path";

import { useApp } from "ink";
import { useState, useCallback, useRef, useMemo } from "react";

import { ClaudeService } from "../services/claudeService.js";
import { COMMANDS } from "../services/commands.js";
import {
  readSelectedModelFromConfig,
  resolveModelId,
  writeSelectedModelToConfig,
  getInvocationCwd,
} from "../services/config.js";
import {
  isVenvReady,
  startServerInBackground,
  stopServer,
  isServerRunning,
  getDefaultPackages,
  updateVenvPackages,
  openNotebookInBrowser,
} from "../services/jupyterService.js";
import { buildPromptWithNotebookPrefix, NOTEBOOK_FILE } from "../services/prompts.js";

type RunningCommand = "execute" | "login" | "examples" | null;

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [runningCommand, setRunningCommand] = useState<RunningCommand>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = useMemo(() => {
    const padWidth = Math.max(...COMMANDS.map((c) => c.name.length), 10);
    return COMMANDS.map((c) => `${c.name.padEnd(padWidth)} - ${c.description}`);
  }, []);

  const executePrompt = useCallback(
    (prompt: string, options?: { includeGuidance?: boolean }) => {
      if (runningCommand && runningCommand !== "examples") {
        return; // Block if a command is already running (except when in examples picker)
      }

      setRunningCommand("execute");
      setOutput((prev) => [...prev, `> ${prompt}`]);
      const calculatedPrompt = buildPromptWithNotebookPrefix(prompt, {
        includeGuidance: options?.includeGuidance ?? true,
      });

      // Create new abort controller for this execution
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Execute in a non-blocking way
      ClaudeService.executePrompt(calculatedPrompt, {
        abortController,
        onMessage: (message: string) => {
          setOutput((prev) => [...prev, message]);
        },
      })
        .then((response) => {
          if (!response.success && response.error) {
            // Check if it's an abort-related error
            if (response.error.includes("aborted") || response.error.includes("cancelled")) {
              setOutput((prev) => [...prev, "⚠️  Operation cancelled by user"]);
            } else {
              setOutput((prev) => [...prev, `Error: ${response.error}`]);
            }
          } else if (response.success) {
            // Open the updated notebook only on success
            openNotebookInBrowser(NOTEBOOK_FILE, {
              onMessage: (line) => setOutput((prev) => [...prev, line]),
            }).catch((e) => {
              setOutput((prev) => [
                ...prev,
                `Failed to open notebook: ${e instanceof Error ? e.message : String(e)}`,
              ]);
            });
          }
        })
        .catch((error) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((error as any).name === "AbortError" || (error as any).message?.includes("aborted")) {
            setOutput((prev) => [...prev, "⚠️  Operation cancelled by user"]);
          } else {
            setOutput((prev) => [
              ...prev,
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ]);
          }
        })
        .finally(() => {
          setRunningCommand(null);
          abortControllerRef.current = null;
        });
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

      if (command === "/restart") {
        if (!isVenvReady()) {
          setOutput((prev) => [
            ...prev,
            "Environment not installed. Restart the app to set it up.",
          ]);
          return;
        }
        try {
          if (isServerRunning()) {
            await stopServer({ onMessage: (line) => setOutput((prev) => [...prev, line]) });
          }
          await startServerInBackground({
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error restarting server: ${error instanceof Error ? error.message : String(error)}`,
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
          executePrompt(`fix this error: ${tracebackText}`, { includeGuidance: false });
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

  return {
    output,
    handleCommand,
    executePrompt,
    abortExecution,
    appendOutput,
    runningCommand,
  };
};
