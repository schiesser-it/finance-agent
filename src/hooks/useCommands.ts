import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

import { useApp } from "ink";
import { useState, useCallback, useRef, useMemo } from "react";

import { ClaudeService } from "../services/claudeService.js";
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

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = useMemo(
    () => [
      "/help       - Show available commands",
      "/examples   - Show example prompts",
      "/start      - Start Jupyter Notebook server",
      "/stop       - Stop Jupyter Notebook server",
      "/update     - Update the Jupyter Notebook server",
      "/restart    - Delete the notebook to start fresh",
      "/quit       - Exit the application",
    ],
    [],
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

      if (command === "/start") {
        if (!isVenvReady()) {
          setOutput((prev) => [
            ...prev,
            "Environment not installed. Restart the app to set it up.",
          ]);
          return;
        }
        if (isServerRunning()) {
          setOutput((prev) => [...prev, "Server already running."]);
          return;
        }
        try {
          await startServerInBackground({
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error starting server: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/stop") {
        try {
          await stopServer({ onMessage: (line) => setOutput((prev) => [...prev, line]) });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error stopping server: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/restart") {
        const notebookPath = path.resolve(process.cwd(), NOTEBOOK_FILE);
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

      if (command === "/quit") {
        exit();
        return;
      }

      setOutput((prev) => [...prev, "Unknown command. Type /help for available commands."]);
    },
    [exit, availableCommands],
  );

  const executePrompt = useCallback(
    (prompt: string) => {
      if (isExecuting) {
        return; // Block if already executing
      }

      setIsExecuting(true);
      setOutput((prev) => [...prev, `> ${prompt}`]);
      const calculatedPrompt = buildPromptWithNotebookPrefix(prompt);

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
          if (error.name === "AbortError" || error.message?.includes("aborted")) {
            setOutput((prev) => [...prev, "⚠️  Operation cancelled by user"]);
          } else {
            setOutput((prev) => [
              ...prev,
              `Error: ${error instanceof Error ? error.message : String(error)}`,
            ]);
          }
        })
        .finally(() => {
          setIsExecuting(false);
          abortControllerRef.current = null;
        });
    },
    [isExecuting],
  );

  const abortExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    output,
    handleCommand,
    executePrompt,
    isExecuting,
    abortExecution,
  };
};
