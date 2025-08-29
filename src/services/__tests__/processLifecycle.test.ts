import * as fs from "node:fs";
import * as path from "node:path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import * as config from "../config";
import {
  cleanupManagedMeta,
  isManagedProcessRunning,
  readManagedMeta,
  stopManagedProcess,
  writeManagedMeta,
  type ManagedMeta,
} from "../processLifecycle";
import * as venv from "../venv.js";

vi.mock("node:fs");
vi.mock("../config");
vi.mock("../venv.js", () => ({ waitForProcessExit: vi.fn(async () => true) }));

const mockFs = vi.mocked(fs);
const mockConfig = vi.mocked(config);
const mockVenv = vi.mocked(venv);

describe("processLifecycle", () => {
  const fakeConfigDir = "/tmp/finagent-test-config";
  const metaPathNotebook = path.join(fakeConfigDir, "jupyter.meta.json");
  const metaPathDashboard = path.join(fakeConfigDir, "dashboard.meta.json");

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.getConfigDir.mockReturnValue(fakeConfigDir);

    // fs defaults
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.unlinkSync.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("readManagedMeta returns null when file missing or invalid", () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(readManagedMeta("notebook")).toBeNull();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{\n  "pid": "not-a-number"\n}');
    expect(readManagedMeta("dashboard")).toBeNull();
  });

  it("writeManagedMeta writes JSON and readManagedMeta reads it back", () => {
    const meta: ManagedMeta = { pid: 1234, port: 9999, cwd: "/work" };
    writeManagedMeta("notebook", meta);
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      metaPathNotebook,
      JSON.stringify(meta, null, 2),
      { encoding: "utf8" },
    );

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(meta));
    expect(readManagedMeta("notebook")).toEqual(meta);
  });

  it("cleanupManagedMeta removes the meta file if it exists", () => {
    mockFs.existsSync.mockReturnValue(true);
    cleanupManagedMeta("dashboard");
    expect(mockFs.unlinkSync).toHaveBeenCalledWith(metaPathDashboard);
  });

  it("isManagedProcessRunning handles pid cases and process.kill", () => {
    // no meta
    mockFs.existsSync.mockReturnValue(false);
    expect(isManagedProcessRunning("notebook")).toBe(false);

    // invalid pid
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 0 }));
    expect(isManagedProcessRunning("notebook")).toBe(false);

    // valid pid but kill throws -> false
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 4321 }));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("nope");
    });
    expect(isManagedProcessRunning("dashboard")).toBe(false);

    // kill ok -> true
    killSpy.mockImplementation(() => true as unknown as void);
    expect(isManagedProcessRunning("dashboard")).toBe(true);
  });

  it("stopManagedProcess sends SIGTERM then succeeds", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 7777 }));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true as unknown as void);
    (mockVenv.waitForProcessExit as unknown as vi.Mock).mockResolvedValueOnce(true);

    const messages: string[] = [];
    await stopManagedProcess("dashboard", { onMessage: (l) => messages.push(l) });
    expect(killSpy).toHaveBeenCalledWith(7777, "SIGTERM");
    // cleanupManagedMeta should have been attempted
    expect(messages.some((m) => m.includes("✅ dashboard process stopped."))).toBe(true);
  });

  it("stopManagedProcess escalates to SIGKILL when needed", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ pid: 8888 }));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true as unknown as void);
    // first wait false (after TERM), then true (after KILL)
    (mockVenv.waitForProcessExit as unknown as vi.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const messages: string[] = [];
    await stopManagedProcess("notebook", { onMessage: (l) => messages.push(l) });
    expect(killSpy).toHaveBeenCalledWith(8888, "SIGKILL");
    expect(messages.some((m) => m.includes("Sending SIGKILL"))).toBe(true);
    expect(messages.some((m) => m.includes("✅ notebook process stopped."))).toBe(true);
  });

  it("stopAllManagedProcesses attempts both modes", async () => {
    // ensure no processes appear to be running
    mockFs.existsSync.mockReturnValue(false);
    const { stopAllManagedProcesses } = await import("../processLifecycle");
    const messages: string[] = [];
    await stopAllManagedProcesses({ onMessage: (l) => messages.push(l) });
    expect(messages.some((m) => m.includes("No running notebook process found."))).toBe(true);
    expect(messages.some((m) => m.includes("No running dashboard process found."))).toBe(true);
  });
});
