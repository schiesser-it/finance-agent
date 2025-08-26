import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DashboardArtifact, DASHBOARD_FILE } from "../DashboardArtifact";

describe("DashboardArtifact.fix", () => {
  let artifact: DashboardArtifact;

  beforeEach(() => {
    artifact = new DashboardArtifact();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls executePrompt with last traceback and resets it", async () => {
    (artifact as unknown as { lastTraceback: string | null }).lastTraceback = "Traceback: boom";
    const messages: string[] = [];

    const exec = vi.fn(
      async (prompt: string, opts?: { echoPrompt?: boolean; useRawPrompt?: boolean }) => {
        expect(prompt).toContain(`fix this error in the ${DASHBOARD_FILE}:`);
        expect(prompt).toContain("Traceback: boom");
        expect(opts?.useRawPrompt).toBe(true);
        return { success: true } as const;
      },
    );

    await artifact.fix(exec, { onMessage: (l) => messages.push(l) });

    // lastTraceback should be reset
    expect((artifact as unknown as { lastTraceback: string | null }).lastTraceback).toBeNull();
    // success message emitted
    expect(messages.some((m) => m.includes("Dashboard error fixed"))).toBe(true);
  });

  it("logs when no traceback is captured yet", async () => {
    (artifact as unknown as { lastTraceback: string | null }).lastTraceback = null;
    const messages: string[] = [];
    const exec = vi.fn(async () => ({ success: true }) as const);

    await artifact.fix(exec, { onMessage: (l) => messages.push(l) });

    expect(exec).not.toHaveBeenCalled();
    expect(messages.some((m) => m.includes("No dashboard error captured"))).toBe(true);
  });
});
