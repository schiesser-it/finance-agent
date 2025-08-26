import { existsSync } from "node:fs";

import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { createArtifact } from "../services/artifacts/factory.js";
import { readGenerationModeFromConfig } from "../services/config.js";

interface CleanupGateProps {
  children?: React.ReactNode;
}

const CleanupGate: React.FC<CleanupGateProps> = ({ children }) => {
  const [exists, setExists] = useState<boolean | null>(null);
  const [blinkOn, setBlinkOn] = useState<boolean>(true);
  const [currentMode, setCurrentMode] = useState<string>("notebook");

  useEffect(() => {
    const mode = readGenerationModeFromConfig();
    const file = createArtifact(mode).getFilePath();
    setCurrentMode(mode);

    try {
      setExists(existsSync(file));
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
