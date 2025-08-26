import * as fs from "node:fs";
import * as path from "node:path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as config from "../../config";
import { NotebookArtifact, NOTEBOOK_FILE } from "../NotebookArtifact";

vi.mock("node:fs");
vi.mock("../../config");

const mockFs = vi.mocked(fs);
const mockConfig = vi.mocked(config);

describe("NotebookArtifact.fix", () => {
  const artifact = new NotebookArtifact();
  const cwd = "/test/cwd";
  const notebookPath = path.resolve(cwd, NOTEBOOK_FILE);

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.getInvocationCwd.mockReturnValue(cwd);
    mockFs.readFileSync.mockReturnValue("");
    mockFs.existsSync.mockImplementation((p: fs.PathLike) => String(p) === notebookPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls executePrompt with traceback when error found", async () => {
    const nb = {
      cells: [
        {
          outputs: [
            {
              output_type: "error",
              traceback: ["Trace 1", "Trace 2"],
            },
          ],
        },
      ],
    };
    mockFs.readFileSync.mockReturnValue(JSON.stringify(nb));

    const calls: Array<{
      prompt: string;
      opts?: { echoPrompt?: boolean; useRawPrompt?: boolean };
    }> = [];
    const exec = vi.fn(
      async (prompt: string, opts?: { echoPrompt?: boolean; useRawPrompt?: boolean }) => {
        calls.push({ prompt, opts });
        return { success: true } as const;
      },
    );

    await artifact.fix(exec);

    expect(exec).toHaveBeenCalledTimes(1);
    expect(calls[0].prompt).toContain(`fix this error in the notebook ${NOTEBOOK_FILE}:`);
    expect(calls[0].prompt).toContain("Trace 1\nTrace 2");
    expect(calls[0].opts?.useRawPrompt).toBe(true);
  });

  it("logs when file is missing", async () => {
    mockFs.existsSync.mockReturnValue(false);
    const messages: string[] = [];
    const exec = vi.fn(async () => ({ success: true }) as const);

    await artifact.fix(exec, { onMessage: (l) => messages.push(l) });
    expect(messages.some((m) => m.includes(`No \`${NOTEBOOK_FILE}\` found.`))).toBe(true);
    expect(exec).not.toHaveBeenCalled();
  });

  it("logs when no traceback present", async () => {
    const nb = { cells: [{ outputs: [{ output_type: "stream", text: ["hello"] }] }] };
    mockFs.readFileSync.mockReturnValue(JSON.stringify(nb));
    const messages: string[] = [];
    const exec = vi.fn(async () => ({ success: true }) as const);

    await artifact.fix(exec, { onMessage: (l) => messages.push(l) });
    expect(messages.some((m) => m.includes("No error traceback found"))).toBe(true);
    expect(exec).not.toHaveBeenCalled();
  });
});
