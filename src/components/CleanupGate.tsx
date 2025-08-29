import { existsSync } from "node:fs";

import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { createArtifact } from "../services/artifacts/factory.js";
import { readGenerationModeFromConfig, type GenerationMode } from "../services/config.js";

interface CleanupGateProps {
  children?: React.ReactNode;
}

export function getCleanupWarningMessage(mode: GenerationMode): string[] {
  const artifactType = mode === "notebook" ? "Jupyter notebook" : "dashboard";
  return [
    `⚠️  A ${artifactType} file already exists.`,
    `   Run /reset to delete it and start fresh or /open to open it.`,
  ];
}

const CleanupGate: React.FC<CleanupGateProps> = ({ children }) => {
  const [exists, setExists] = useState<boolean | null>(null);
  const [blinkOn, setBlinkOn] = useState<boolean>(true);
  const [currentMode, setCurrentMode] = useState<GenerationMode>("notebook");

  useEffect(() => {
    const checkFileExists = () => {
      const mode = readGenerationModeFromConfig();
      const file = createArtifact(mode).getFilePath();
      setCurrentMode(mode);

      try {
        const fileExists = existsSync(file);
        setExists(fileExists);
      } catch {
        setExists(false);
      }
    };

    // Check initially
    checkFileExists();

    // Set up a more frequent check to detect changes from /reset command
    // This ensures the warning disappears promptly when files are deleted
    const interval = setInterval(checkFileExists, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!exists) return;
    const interval = setInterval(() => setBlinkOn((v) => !v), 700);
    return () => clearInterval(interval);
  }, [exists]);

  const getWarningMessage = () => {
    const warningLines = getCleanupWarningMessage(currentMode);
    return warningLines.join("\n   ");
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
