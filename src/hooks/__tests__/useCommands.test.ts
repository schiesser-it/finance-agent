import * as fs from "node:fs";
import * as path from "node:path";

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ClaudeService } from "../../services/claudeService";
import * as config from "../../services/config";
import * as cleanup from "../../services/cleanup";
// Artifacts factory mock (uses a shared object captured by closure)
const mockArtifact = {
  mode: "notebook" as const,
  fileName: "analysis.ipynb",
  buildGeneratePrompt: vi.fn((p: string) => `ARTIFACT_PROMPT: ${p}`),
  runProcess: vi.fn(async () => {}),
  getFilePath: vi.fn(() => "/test/cwd/analysis.ipynb"),
  fix: vi.fn(async () => {}),
};
vi.mock("../../services/artifacts/factory.js", () => {
  const createArtifact = vi.fn(() => mockArtifact);
  return { createArtifact };
});
import { useCommands } from "../useCommands";

// Mock dependencies
vi.mock("ink", () => ({
  useApp: vi.fn(() => ({ exit: vi.fn() })),
}));

vi.mock("../../services/claudeService");
vi.mock("../../services/config");
vi.mock("../../services/cleanup");
vi.mock("../../services/venv");
vi.mock("node:fs");
vi.mock("node:path");

const mockClaudeService = vi.mocked(ClaudeService);
const mockConfig = vi.mocked(config);
const mockCleanup = vi.mocked(cleanup);
const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe("useCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockConfig.getInvocationCwd.mockReturnValue("/test/cwd");
    mockConfig.readGenerationModeFromConfig.mockReturnValue("notebook");
    mockCleanup.checkForExistingFile.mockReturnValue({ exists: false, mode: "notebook" });
    mockCleanup.getCleanupWarningMessage.mockReturnValue(["⚠️ Warning message"]);
    mockPath.resolve.mockImplementation((...segments) => segments.join("/"));
    mockFs.existsSync.mockReturnValue(false);
    // reset artifact mocks
    mockArtifact.mode = "notebook";
    mockArtifact.fileName = "analysis.ipynb";
    mockArtifact.buildGeneratePrompt = vi.fn((p: string) => `ARTIFACT_PROMPT: ${p}`);
    mockArtifact.runProcess = vi.fn(async () => {});
    mockArtifact.getFilePath = vi.fn(() => "/test/cwd/analysis.ipynb");
    mockArtifact.fix = vi.fn(async () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("executePrompt", () => {
    it("should execute a prompt successfully", async () => {
      const mockResponse = { success: true };
      mockClaudeService.executePrompt.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        const response = await result.current.executePrompt("test prompt");
        expect(response).toEqual(mockResponse);
      });

      const [promptArg, optionsArg] = mockClaudeService.executePrompt.mock.calls[0];
      expect(typeof promptArg).toBe("string");
      // Validates prompt is built via the Artifact
      expect(promptArg).toContain("ARTIFACT_PROMPT: test prompt");

      expect(optionsArg).toEqual(
        expect.objectContaining({
          abortController: expect.any(AbortController),
          onMessage: expect.any(Function),
        }),
      );
    });

    it("should handle execution errors gracefully", async () => {
      const mockError = new Error("API Error");
      mockClaudeService.executePrompt.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        const response = await result.current.executePrompt("test prompt");
        expect(response).toEqual({ success: false, error: "API Error" });
      });

      expect(result.current.output).toContain("Error: API Error");
    });

    it("should update output during execution", async () => {
      let onMessageCallback: ((message: string) => void) | undefined;

      mockClaudeService.executePrompt.mockImplementation(async (prompt, options) => {
        onMessageCallback = options?.onMessage;

        // Simulate streaming messages
        if (onMessageCallback) {
          onMessageCallback("Processing...");
          onMessageCallback("Almost done...");
        }

        return { success: true };
      });

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.executePrompt("test prompt");
      });

      expect(result.current.output).toContain("Processing...");
      expect(result.current.output).toContain("Almost done...");
    });

    it("should not fail when opening artifact fails", async () => {
      const mockResponse = { success: true };
      mockClaudeService.executePrompt.mockResolvedValue(mockResponse);
      // make runProcess throw
      mockArtifact.runProcess = vi.fn(async () => {
        throw new Error("open error");
      });

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        const response = await result.current.executePrompt("test prompt");
        expect(response).toEqual(mockResponse);
      });

      expect(result.current.output.some((l) => l.includes("Failed to open notebook"))).toBe(true);
    });
  });

  describe("handleCommand", () => {
    it("should handle /help command", async () => {
      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/help");
      });

      expect(result.current.output).toContain("Available commands:");
      expect(result.current.output.some((line) => line.includes("/help"))).toBe(true);
    });

    it("should handle /reset command when notebook exists", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {});

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/reset");
      });

      expect(mockFs.unlinkSync).toHaveBeenCalled();
      expect(
        result.current.output.some(
          (line) => line.includes("Removed") && line.includes("analysis.ipynb"),
        ),
      ).toBe(true);
    });

    it("should handle /reset command when notebook does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/reset");
      });

      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
      expect(
        result.current.output.some(
          (line) =>
            line.includes("No") && line.includes("analysis.ipynb") && line.includes("found"),
        ),
      ).toBe(true);
    });

    it("should handle /model command without argument", async () => {
      mockConfig.readSelectedModelFromConfig.mockReturnValue("claude-sonnet-4");

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/model");
      });

      expect(result.current.output).toContain("Current model: claude-sonnet-4");
      expect(result.current.output.some((line) => line.includes("Available models:"))).toBe(true);
    });

    it("should handle /model command with valid argument", async () => {
      mockConfig.resolveModelId.mockReturnValue("claude-opus-4-1-20250805");
      mockConfig.readSelectedModelFromConfig.mockReturnValue("claude-opus-4-1-20250805");
      mockConfig.writeSelectedModelToConfig.mockImplementation(() => {});

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/model opus");
      });

      expect(mockConfig.writeSelectedModelToConfig).toHaveBeenCalledWith(
        "claude-opus-4-1-20250805",
      );
      expect(result.current.output.some((line) => line.includes("✅ Model set to:"))).toBe(true);
    });

    it("should handle /mode command and show cleanup warning when destination file exists", async () => {
      // Mock that current mode is notebook and no notebook file exists
      mockConfig.readGenerationModeFromConfig.mockReturnValue("notebook");
      mockArtifact.mode = "notebook";
      mockArtifact.getFilePath.mockReturnValue("/test/cwd/analysis.ipynb");

      // Mock that dashboard file exists (destination)
      const dashboardArtifact = {
        ...mockArtifact,
        mode: "dashboard" as const,
        fileName: "dashboard.py",
        getFilePath: vi.fn(() => "/test/cwd/dashboard.py"),
        lastTraceback: null,
      };

      // Mock createArtifact to return different artifacts based on mode
      const { createArtifact } = await import("../../services/artifacts/factory.js");
      vi.mocked(createArtifact).mockImplementation((mode) => {
        if (mode === "dashboard") return dashboardArtifact as any;
        return mockArtifact;
      });

      // Mock file system: notebook doesn't exist, dashboard exists
      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === "string") {
          return filePath.includes("dashboard.py");
        }
        return false;
      });

      mockConfig.writeGenerationModeToConfig.mockImplementation(() => {});

      // Mock cleanup service to return warning messages
      mockCleanup.getCleanupWarningMessage.mockReturnValue([
        "⚠️  A dashboard file already exists.",
        "   Run /reset to delete it and start fresh or /open to open it.",
      ]);

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/mode dashboard");
      });

      expect(mockConfig.writeGenerationModeToConfig).toHaveBeenCalledWith("dashboard");
      expect(result.current.output).toContain("✅ Mode set to: dashboard");
      expect(
        result.current.output.some((line) => line.includes("⚠️  A dashboard file already exists.")),
      ).toBe(true);
      expect(
        result.current.output.some((line) =>
          line.includes("Run /reset to delete it and start fresh"),
        ),
      ).toBe(true);
    });

    it("should not show cleanup warning when switching modes if source file exists (conversion flow)", async () => {
      // Mock that current mode is notebook and notebook file exists
      mockConfig.readGenerationModeFromConfig.mockReturnValue("notebook");
      mockArtifact.mode = "notebook";
      mockArtifact.getFilePath.mockReturnValue("/test/cwd/analysis.ipynb");

      // Mock that dashboard file also exists (destination)
      const dashboardArtifact = {
        ...mockArtifact,
        mode: "dashboard" as const,
        fileName: "dashboard.py",
        getFilePath: vi.fn(() => "/test/cwd/dashboard.py"),
        lastTraceback: null,
      };

      const { createArtifact } = await import("../../services/artifacts/factory.js");
      vi.mocked(createArtifact).mockImplementation((mode) => {
        if (mode === "dashboard") return dashboardArtifact as any;
        return mockArtifact;
      });

      // Mock file system: both files exist
      mockFs.existsSync.mockReturnValue(true);

      mockConfig.writeGenerationModeToConfig.mockImplementation(() => {});

      // Mock cleanup service (shouldn't be called in this case since conversion flow is triggered)
      mockCleanup.getCleanupWarningMessage.mockReturnValue([
        "⚠️  A dashboard file already exists.",
        "   Run /reset to delete it and start fresh or /open to open it.",
      ]);

      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/mode dashboard");
      });

      expect(mockConfig.writeGenerationModeToConfig).toHaveBeenCalledWith("dashboard");
      expect(result.current.output).toContain("✅ Mode set to: dashboard");
      // Should not contain cleanup warning since conversion flow is triggered
      expect(
        result.current.output.some((line) => line.includes("⚠️  A dashboard file already exists.")),
      ).toBe(false);
      // Should have set up conversion flow
      expect(result.current.runningCommand).toBe("confirm");
    });

    it("should handle unknown commands", async () => {
      const { result } = renderHook(() => useCommands());

      await act(async () => {
        await result.current.handleCommand("/unknown");
      });

      expect(result.current.output).toContain(
        "Unknown command. Type /help for available commands.",
      );
    });
  });

  describe("runningCommand state", () => {
    it("should set running command during execution", async () => {
      let resolveExecution: () => void;
      const executionPromise = new Promise<void>((resolve) => {
        resolveExecution = resolve;
      });

      mockClaudeService.executePrompt.mockImplementation(async () => {
        await executionPromise;
        return { success: true };
      });

      const { result } = renderHook(() => useCommands());

      expect(result.current.runningCommand).toBe(null);

      act(() => {
        result.current.executePrompt("test");
      });

      expect(result.current.runningCommand).toBe("execute");

      await act(async () => {
        resolveExecution!();
        await executionPromise;
      });

      await waitFor(() => {
        expect(result.current.runningCommand).toBe(null);
      });
    });

    it("should prevent multiple concurrent executions", async () => {
      const { result } = renderHook(() => useCommands());

      // Start first execution
      act(() => {
        result.current.executePrompt("first");
      });

      expect(result.current.runningCommand).toBe("execute");

      // Try to start second execution
      await act(async () => {
        const response = await result.current.executePrompt("second");
        expect(response).toEqual({
          success: false,
          error: "Another command is already running",
        });
      });
    });
  });

  describe("abortExecution", () => {
    it("should abort ongoing execution", async () => {
      let abortController: AbortController;

      mockClaudeService.executePrompt.mockImplementation(async (prompt, options) => {
        abortController = options!.abortController!;
        return new Promise(() => {}); // Never resolves
      });

      const { result } = renderHook(() => useCommands());

      act(() => {
        result.current.executePrompt("test");
      });

      expect(result.current.runningCommand).toBe("execute");

      act(() => {
        result.current.abortExecution();
      });

      expect(result.current.runningCommand).toBe(null);
      expect(abortController!.signal.aborted).toBe(true);
    });
  });

  describe("appendOutput", () => {
    it("should append string output", () => {
      const { result } = renderHook(() => useCommands());

      act(() => {
        result.current.appendOutput("test message");
      });

      expect(result.current.output).toContain("test message");
    });

    it("should append array output", () => {
      const { result } = renderHook(() => useCommands());

      act(() => {
        result.current.appendOutput(["message 1", "message 2"]);
      });

      expect(result.current.output).toContain("message 1");
      expect(result.current.output).toContain("message 2");
    });
  });
});
