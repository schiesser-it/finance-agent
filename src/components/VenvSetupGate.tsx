import { Box, Text, useApp, useInput } from "ink";
import React, { useEffect, useState, useCallback } from "react";

import { ensureVenvAndPackages, isVenvReady } from "../services/venv.js";

import Header from "./Header.js";

type Phase = "checking" | "prompt" | "settingUp" | "done" | "error";

interface VenvSetupGateProps {
  onReady: () => void;
  children?: React.ReactNode;
}

const VenvSetupGate: React.FC<VenvSetupGateProps> = ({ onReady, children }) => {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>("checking");
  const [messages, setMessages] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const appendMessage = useCallback((line: string) => {
    setMessages((prev) => [...prev, line]);
  }, []);

  useEffect(() => {
    try {
      if (isVenvReady()) {
        setPhase("done");
        onReady();
      } else {
        setPhase("prompt");
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSetup = useCallback(async () => {
    setPhase("settingUp");
    setMessages(["Setting up Python venv and required packages..."]);
    try {
      const controller = new AbortController();
      setAbortController(controller);
      await ensureVenvAndPackages({ onMessage: appendMessage, signal: controller.signal });
      appendMessage("✅ Environment ready.");
      setPhase("done");
      onReady();
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [appendMessage, onReady]);

  useInput((input, key) => {
    if (phase === "prompt") {
      if (input?.toLowerCase() === "y") {
        startSetup();
      } else if (input?.toLowerCase() === "n" || key.escape || (key.ctrl && input === "c")) {
        exit();
      }
    } else if (phase === "settingUp") {
      if (key.escape || (key.ctrl && input === "c")) {
        if (abortController) {
          abortController.abort();
        }
        exit();
      }
    }
  });

  if (phase === "done") {
    return <>{children}</>;
  }

  if (phase === "error") {
    return (
      <>
        <Header />
        <Box flexDirection="column">
          <Text color="red">Failed to prepare environment:</Text>
          {errorMessage ? <Text color="red">{errorMessage}</Text> : null}
          <Text>Press Ctrl+C to quit.</Text>
        </Box>
      </>
    );
  }

  if (phase === "settingUp") {
    return (
      <>
        <Header />
        <Box flexDirection="column">
          {messages.map((m, idx) => (
            // eslint-disable-next-line react/no-array-index-key
            <Text key={idx}>{m}</Text>
          ))}
          <Text dimColor>Press Esc or Ctrl+C to cancel and exit.</Text>
        </Box>
      </>
    );
  }

  // checking phase
  if (phase === "checking") {
    return (
      <>
        <Header />
        <Box flexDirection="column">
          <Text>Checking your environment...</Text>
        </Box>
      </>
    );
  }

  // prompt phase
  return (
    <>
      <Header />
      <Box flexDirection="column">
        <Text>Jupyter is not set up.</Text>
        <Text>Set it up now? (y/n)</Text>
        <Text dimColor>
          Choosing &quot;n&quot; will exit the app. You can run again later to set it up.
        </Text>
      </Box>
    </>
  );
};

export default VenvSetupGate;
