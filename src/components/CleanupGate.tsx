import { existsSync } from "node:fs";
import path from "node:path";

import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { getInvocationCwd, readGenerationModeFromConfig } from "../services/config.js";
import { NOTEBOOK_FILE, DASHBOARD_FILE } from "../services/prompts.js";

interface CleanupGateProps {
  children?: React.ReactNode;
}

const CleanupGate: React.FC<CleanupGateProps> = ({ children }) => {
  const [exists, setExists] = useState<boolean | null>(null);
  const [blinkOn, setBlinkOn] = useState<boolean>(true);
  const [currentMode, setCurrentMode] = useState<string>("notebook");

  useEffect(() => {
    const mode = readGenerationModeFromConfig();
    const file = mode === "notebook" ? NOTEBOOK_FILE : DASHBOARD_FILE;
    setCurrentMode(mode);

    try {
      setExists(existsSync(path.resolve(getInvocationCwd(), file)));
    } catch {
      setExists(false);
    }
  }, []);

  useEffect(() => {
    if (!exists) return;
    const interval = setInterval(() => setBlinkOn((v) => !v), 700);
    return () => clearInterval(interval);
  }, [exists]);

  const getWarningMessage = () => {
    const artifactType = currentMode === "notebook" ? "Jupyter notebook" : "dashboard";
    return `⚠️  A ${artifactType} file already exists. \n   Run /reset to delete it and start fresh or /open to open it.`;
  };

  return (
    <>
      {exists ? (
        <Box marginBottom={1}>
          <Text
            backgroundColor={blinkOn ? "yellow" : undefined}
            color={blinkOn ? "black" : undefined}
            dimColor={!blinkOn}
          >
            {getWarningMessage()}
          </Text>
        </Box>
      ) : null}
      {children}
    </>
  );
};

export default CleanupGate;
