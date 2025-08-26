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
} from "../services/config.js";
import { stopDashboard, isDashboardRunning, runDashboard } from "../services/dashboardService.js";
import {
  startServerInBackground,
  stopServer,
  isServerRunning,
  openNotebookInBrowser,
} from "../services/jupyterService.js";
import {
  buildPromptWithNotebookPrefix,
  DASHBOARD_FILE,
  NOTEBOOK_FILE,
} from "../services/prompts.js";
import { getDefaultPackages, isVenvReady, updateVenvPackages } from "../services/venv.js";

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
    async (
      prompt: string,
      options?: {
        includeGuidance?: boolean;
        openNotebookOnSuccess?: boolean;
        echoPrompt?: boolean;
        useRawPrompt?: boolean;
      },
    ): Promise<ClaudeResponse> => {
      if (runningCommand && runningCommand !== "examples") {
        return { success: false, error: "Another command is already running" };
      }

      setRunningCommand("execute");
      if (options?.echoPrompt !== false) {
        setOutput((prev) => [...prev, `> ${prompt}`]);
      }
      const calculatedPrompt = options?.useRawPrompt
        ? prompt
        : buildPromptWithNotebookPrefix(prompt, {
            includeGuidance: options?.includeGuidance ?? true,
          });

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
          if (options?.openNotebookOnSuccess !== false) {
            try {
              await openNotebookInBrowser(NOTEBOOK_FILE, {
                onMessage: (line) => setOutput((prev) => [...prev, line]),
              });
            } catch (e) {
              setOutput((prev) => [
                ...prev,
                `Failed to open notebook: ${e instanceof Error ? e.message : String(e)}`,
              ]);
            }
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
    [runningCommand],
  );

  const handleCommand = useCallback(
    async (command: string) => {
      setOutput((prev) => [...prev, `> ${command}`]);
      if (command === "/help") {
        const conversationStatus = ClaudeService.hasActiveSession()
          ? "✅ Multi-turn conversation active - context will be maintained"
          : "🆕 No active conversation - next prompt will start fresh";
        setOutput((prev) => [
          ...prev,
          conversationStatus,
          "",
          "Available commands:",
          ...availableCommands,
        ]);
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

      if (command === "/dashboard") {
        // Remove any existing dashboard file first
        try {
          const dashboardPath = path.resolve(getInvocationCwd(), DASHBOARD_FILE);
          if (existsSync(dashboardPath)) {
            unlinkSync(dashboardPath);
            setOutput((prev) => [
              ...prev,
              `Removed existing \`${DASHBOARD_FILE}\`. It will be regenerated now.`,
            ]);
          }
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Warning: Failed to remove existing \`${DASHBOARD_FILE}\`: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ]);
        }

        const dashboardPrompt = `Convert the notebook \`@${NOTEBOOK_FILE}\` into a professional Streamlit dashboard with this layout:

## Layout Structure
- **Header**: Title and Date
    - Title: left
    - Date: right
- **KPI Row**: (if the notebook contains any KPIs)
    - Use red for negative trends and green for positive trend
- **Charts Grid**:
    - Use the four best charts from the notebook
- **Bottom Row**: 
   - Add summary or conclusion of the notebook if available

## Key Requirements
- Generate the code in a single file called \`${DASHBOARD_FILE}\`
- Use Plotly for all charts
- Professional styling with trend arrows/colors
- Use uniform card heights for each row
- Show two decimal places for each trend indicator`;

        const response = await executePrompt(dashboardPrompt, {
          openNotebookOnSuccess: false,
          echoPrompt: false,
          useRawPrompt: true,
        });

        if (!response.success) {
          return;
        }

        setOutput((prev) => [
          ...prev,
          `✅ Dashboard generated: \`${DASHBOARD_FILE}\`.`,
          `Run /start-dashboard to launch the server.`,
        ]);
        return;
      }

      if (command === "/start-dashboard") {
        try {
          setOutput((prev) => [...prev, `▶ Running: streamlit run ${DASHBOARD_FILE}`]);
          await runDashboard(DASHBOARD_FILE, {
            onMessage: (line) => setOutput((prev) => [...prev, line]),
          });
          setOutput((prev) => [...prev, `Tip: Use /stop-dashboard to stop the server.`]);
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error starting dashboard: ${error instanceof Error ? error.message : String(error)}`,
          ]);
        }
        return;
      }

      if (command === "/stop-dashboard") {
        try {
          if (!isDashboardRunning()) {
            setOutput((prev) => [...prev, "No running dashboard found."]);
            return;
          }
          await stopDashboard({ onMessage: (line) => setOutput((prev) => [...prev, line]) });
        } catch (error) {
          setOutput((prev) => [
            ...prev,
            `Error stopping dashboard: ${error instanceof Error ? error.message : String(error)}`,
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

      if (command === "/new-conversation") {
        ClaudeService.startNewConversation();
        setOutput((prev) => [
          ...prev,
          "✅ Started a new conversation. Previous context has been cleared.",
        ]);
        return;
      }

      if (command === "/clear-session") {
        ClaudeService.startNewConversation();
        setOutput((prev) => [
          ...prev,
          "🗑️ Cleared stored session file.",
          "Next prompt will start a completely fresh conversation.",
        ]);
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
