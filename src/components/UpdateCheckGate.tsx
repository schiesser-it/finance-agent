import { spawn } from "node:child_process";

import { Box, Text, useApp, useInput } from "ink";
import React, { useCallback, useEffect, useState } from "react";

import { version as currentVersion } from "../../package.json";

import Header from "./Header.js";

type Phase = "checking" | "prompt" | "updating" | "done" | "error";

interface UpdateCheckGateProps {
  children?: React.ReactNode;
}

function compareSemver(a: string, b: string): number {
  const aParts = a.split(".").map((p) => parseInt(p, 10));
  const bParts = b.split(".").map((p) => parseInt(p, 10));
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i += 1) {
    const av = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bv = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function fetchLatestVersion(pkgName: string): Promise<string | null> {
  try {
    // Prefer the lightweight /latest endpoint
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

const UpdateCheckGate: React.FC<UpdateCheckGateProps> = ({ children }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("checking");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const latest = await fetchLatestVersion("finagent");
      if (cancelled) return;
      if (!latest) {
        setPhase("done");
        return;
      }
      setLatestVersion(latest);
      const cmp = compareSemver(currentVersion, latest);
      if (cmp >= 0) {
        setPhase("done");
      } else {
        setPhase("prompt");
      }
    })().catch(() => setPhase("done"));
    return () => {
      cancelled = true;
    };
  }, []);

  const runUpdate = useCallback(async () => {
    setPhase("updating");
    setMessages(["Updating finagent with npm ..."]);
    await new Promise<void>((resolve) => {
      const child = spawn("npm", ["install", "-g", "finagent@latest"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (d) => {
        const s = String(d);
        for (const line of s.split(/\r?\n/)) {
          if (!line) continue;
          setMessages((prev) => [...prev, line]);
        }
      });
      child.stderr.on("data", (d) => {
        const s = String(d);
        for (const line of s.split(/\r?\n/)) {
          if (!line) continue;
          setMessages((prev) => [...prev, line]);
        }
      });
      child.on("close", (code) => {
        if (code === 0) {
          setMessages((prev) => [
            ...prev,
            "✅ finagent updated. Please restart the app to use the new version.",
          ]);
          // Exit to encourage restart into the new version
          exit();
        } else {
          setErrorMessage(`npm exited with code ${code ?? "unknown"}`);
          setPhase("error");
        }
        resolve();
      });
      child.on("error", (err) => {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase("error");
        resolve();
      });
    });
  }, [exit]);

  useInput((input, key) => {
    if (phase === "prompt") {
      if (input?.toLowerCase() === "y") {
        void runUpdate();
      } else if (input?.toLowerCase() === "n" || key.escape) {
        setPhase("done");
      }
    }
    if (phase === "error") {
      if (key.escape || (key.ctrl && input === "c")) {
        setPhase("done");
      }
    }
  });

  if (phase === "done") {
    return <>{children}</>;
  }

  if (phase === "updating") {
    return (
      <>
        <Header />
        <Box flexDirection="column">
          {messages.map((m, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={idx}>{m}</Text>
          ))}
          <Text dimColor>Updating... This may take a minute.</Text>
        </Box>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <Header />
        <Box flexDirection="column">
          <Text color="red">Failed to update finagent via npm.</Text>
          {errorMessage ? <Text color="red">{errorMessage}</Text> : null}
          <Text dimColor>Press Esc to continue without updating.</Text>
        </Box>
      </>
    );
  }

  // checking or prompt
  return (
    <>
      <Header />
      <Box flexDirection="column">
        {phase === "checking" ? (
          <Text dimColor>Checking for updates...</Text>
        ) : (
          <>
            <Text>
              A newer version of finagent is available: v{currentVersion} → v{latestVersion}
            </Text>
            <Text>Update now? (y/n)</Text>
          </>
        )}
      </Box>
    </>
  );
};

export default UpdateCheckGate;
