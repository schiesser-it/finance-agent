import { existsSync } from "node:fs";
import path from "node:path";

import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { getInvocationCwd } from "../services/config.js";
import { NOTEBOOK_FILE } from "../services/prompts.js";

interface NotebookCleanupGateProps {
  children?: React.ReactNode;
}

const NotebookCleanupGate: React.FC<NotebookCleanupGateProps> = ({ children }) => {
  const [exists, setExists] = useState<boolean | null>(null);
  const [blinkOn, setBlinkOn] = useState<boolean>(true);

  const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);

  useEffect(() => {
    try {
      setExists(existsSync(notebookPath));
    } catch {
      setExists(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!exists) return;
    const interval = setInterval(() => setBlinkOn((v) => !v), 700);
    return () => clearInterval(interval);
  }, [exists]);

  return (
    <>
      {exists ? (
        <Box marginBottom={1}>
          <Text
            backgroundColor={blinkOn ? "yellow" : undefined}
            color={blinkOn ? "black" : undefined}
            dimColor={!blinkOn}
          >
            {
              "⚠️  A Jupyter notebook file already exists. \n   Run /reset to delete it and start fresh."
            }
          </Text>
        </Box>
      ) : null}
      {children}
    </>
  );
};

export default NotebookCleanupGate;
