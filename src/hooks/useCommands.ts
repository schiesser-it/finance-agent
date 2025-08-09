import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

import { useApp } from "ink";
import { useState, useCallback, useRef, useMemo } from "react";

import { ClaudeService } from "../services/claudeService.js";
import {
  ensureVenvAndPackages,
  isVenvReady,
  startServerInBackground,
  stopServer,
  isServerRunning,
  getDefaultPackages,
} from "../services/jupyterService.js";
import { buildPromptWithNotebookPrefix, NOTEBOOK_FILE } from "../services/prompts.js";

const INITIAL_MESSAGES = [
  "Welcome to Finance Agent!",
  "Available commands:",
  "  /help   - Show available commands",
  "  /start  - Start Jupyter Notebook server",
  "  /stop   - Stop Jupyter Notebook server",
  "  /setup  - Install Jupyter venv into $HOME/.finance-agent",
  "  /restart- Delete the notebook to start fresh",
  "  /quit   - Exit the application",
  "Type @ followed by text to reference files.",
  "Enter any text as a prompt to execute it.",
  "",
];

export const useCommands = () => {
  const [output, setOutput] = useState<string[]>(INITIAL_MESSAGES);
  const [isExecuting, setIsExecuting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { exit } = useApp();

  const availableCommands = useMemo(
    () => [
      "/help   - Show available commands",
      "/start  - Start Jupyter Notebook server",
      "/stop   - Stop Jupyter Notebook server",
      "/setup  - Install Jupyter venv into $HOME/.finance-agent",
      "/restart- Delete the notebook to start fresh",
      "/quit   - Exit the application",
    ],
    [],
  );

  const handleCommand = useCallback(
    async (command: string) => {
      if (command === "/help") {
        setOutput((prev) => [...prev, "> /help", "Available commands:", ...availableCommands]);
        return;
      }

      if (command === "/setup") {
        setOutput((prev) => [...prev, "> /setup", "Installing environment ..."]);
        try {
          await ensureVenvAndPackages({
            packages: getDefaultPackages(),
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
          setOutput((prev) => [...prev, "✅ Environment ready."]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error setting up environment: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/start") {
        if (!isVenvReady()) {
          setOutput((prev) => [
            ...prev,
            "> /start",
            "Environment not installed. Run /setup first.",
          ]);
          return;
        }
        if (isServerRunning()) {
          setOutput((prev) => [...prev, "> /start", "Server already running."]);
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
              "> /restart",
              `Removed \`${NOTEBOOK_FILE}\`. Next run will create a fresh notebook.`,
            ]);
          } else {
            setOutput((prev) => [
              ...prev,
              "> /restart",
              `No \`${NOTEBOOK_FILE}\` found. Nothing to remove.`,
            ]);
          }
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            "> /restart",
            `Error removing \`${NOTEBOOK_FILE}\`: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/quit") {
        exit();
        return;
      }

      setOutput((prev) => [
        ...prev,
        `> ${command}`,
        "Unknown command. Type /help for available commands.",
      ]);
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
