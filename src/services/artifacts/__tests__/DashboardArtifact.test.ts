import { EventEmitter } from "node:events";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { DashboardArtifact, DASHBOARD_FILE } from "../DashboardArtifact";

vi.mock("node:child_process");
vi.mock("../../config");
vi.mock("../../network");
vi.mock("../../processLifecycle");
vi.mock("../../browser");
vi.mock("../../venv");

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

describe("DashboardArtifact.runProcess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures traceback from a single multi-line chunk and triggers onTraceback", async () => {
    const childProcess = await setupSpawnMocks();

    const artifact = new DashboardArtifact();
    const traces: string[] = [];

    await artifact.runProcess({
      onMessage: () => {},
      onTraceback: (t) => traces.push(t),
    });

    const chunk = [
      "Traceback (most recent call last):",
      '  File "/app/dashboard.py", line 74, in load_data',
      "ValueError: If using all scalar values, you must pass an index",
      "",
    ].join("\n");

    childProcess.stdout.emit("data", chunk);

    expect(traces.length).toBe(1);
    expect(traces[0]).toContain("Traceback (most recent call last):");
    expect(traces[0]).toContain("ValueError: If using all scalar values, you must pass an index");
  });
});

async function setupSpawnMocks() {
  const childProcModule = await import("node:child_process");
  const config = await import("../../config");
  const network = await import("../../network");
  const lifecycle = await import("../../processLifecycle");
  const browser = await import("../../browser");
  const venv = await import("../../venv");

  const mockSpawnSync = vi.mocked(childProcModule.spawnSync);
  const mockSpawn = vi.mocked(childProcModule.spawn);
  const mockGetInvocationCwd = vi.mocked(config.getInvocationCwd);
  const mockGetVenvDir = vi.mocked(config.getVenvDir);
  const mockPickPort = vi.mocked(network.pickAvailablePort);
  const mockWaitForPort = vi.mocked(network.waitForPortOpen);
  const mockIsRunning = vi.mocked(lifecycle.isManagedProcessRunning);
  const mockWriteMeta = vi.mocked(lifecycle.writeManagedMeta);
  const mockEnsureDir = vi.mocked(config.ensureConfigDir);
  const mockOpenUrl = vi.mocked(browser.openExternalUrl);
  const mockEnsureUv = vi.mocked(venv.ensureUvInstalled);

  mockEnsureUv.mockResolvedValue();
  mockSpawnSync.mockReturnValue({ status: 0 } as unknown as ReturnType<typeof mockSpawnSync>);
  mockGetInvocationCwd.mockReturnValue("/cwd");
  mockGetVenvDir.mockReturnValue("/venv");
  mockPickPort.mockResolvedValue(8501);
  mockWaitForPort.mockResolvedValue();
  mockIsRunning.mockReturnValue(false);
  mockWriteMeta.mockImplementation(() => {});
  mockEnsureDir.mockImplementation(() => "/cfg");
  mockOpenUrl.mockResolvedValue();

  class MockChild extends EventEmitter {
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    pid = 12345;
  }

  const child = new MockChild();
  mockSpawn.mockReturnValue(child as unknown as ReturnType<typeof mockSpawn>);

  return child;
}
