import { Box, useInput, useApp, Text } from "ink";
import type { Key } from "ink";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import FileSearch from "./components/FileSearch.js";
import Header from "./components/Header.js";
import InputPrompt from "./components/InputPrompt.js";
import OutputDisplay from "./components/OutputDisplay.js";
import VenvSetupGate from "./components/VenvSetupGate.js";
import { useCommands } from "./hooks/useCommands.js";
import { useFileSearch } from "./hooks/useFileSearch.js";
import { useInputState } from "./hooks/useInput.js";
import { isServerRunning, startServerInBackground, stopServer } from "./services/jupyterService.js";

const MainUI: React.FC = () => {
  const { exit } = useApp();

  const {
    fileMatches,
    selectedFileIndex,
    showingFiles,
    updateFileMatches,
    clearFileSearch,
    selectPreviousFile,
    selectNextFile,
  } = useFileSearch();

  const { output, handleCommand, executePrompt, isExecuting, abortExecution } = useCommands();

  const {
    input,
    clearInput,
    addCharacter,
    removeLastCharacter,
    insertFileReference,
    pushHistory,
    historyPrev,
    historyNext,
  } = useInputState();

  const [firstCommand, setFirstCommand] = useState(true);

  const trimmedInput = useMemo(() => input.trim(), [input]);
  const showExamples = useMemo(
    () => firstCommand && trimmedInput.length === 0,
    [firstCommand, trimmedInput],
  );

  useEffect(() => {
    updateFileMatches(input);
  }, [input, updateFileMatches]);

  const handleFileSelection = () => {
    if (fileMatches.length > 0) {
      insertFileReference(fileMatches[selectedFileIndex].path);
      clearFileSearch();
    }
  };

  const handleInputSubmission = () => {
    const effectiveInput = showExamples ? "/examples" : trimmedInput;

    if (effectiveInput.length === 0) {
      clearInput();
      if (firstCommand) setFirstCommand(false);
      return;
    }

    if (effectiveInput.startsWith("/")) {
      handleCommand(effectiveInput);
    } else {
      executePrompt(effectiveInput);
    }

    pushHistory(effectiveInput);
    clearInput();

    if (firstCommand) setFirstCommand(false);
  };

  useInput((inputChar: string, key: Key) => {
    if (key.ctrl && inputChar === "c") {
      if (isExecuting) {
        abortExecution();
        return;
      }
      exit();
      return;
    }

    if (isExecuting) {
      return;
    }

    if (showingFiles) {
      if (key.upArrow) {
        selectPreviousFile();
        return;
      }
      if (key.downArrow) {
        selectNextFile();
        return;
      }
      if (key.return || key.tab) {
        handleFileSelection();
        return;
      }
      if (key.escape) {
        clearFileSearch();
        return;
      }
    }

    if (key.upArrow) {
      historyPrev();
      return;
    }
    if (key.downArrow) {
      historyNext();
      return;
    }

    if (key.return) {
      handleInputSubmission();
      return;
    }

    if (key.backspace || key.delete) {
      removeLastCharacter();
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      addCharacter(inputChar);
    }
  });

  return (
    <Box flexDirection="column">
      <Header />
      <Box flexDirection="column" marginBottom={1}>
        <Text color="cyan">
          Type any text as your prompt, use /help to see available commands, /examples to show
          examples, or Ctrl+C to quit
        </Text>
        <Text color="gray">
          {
            "Type @ followed to reference files (e.g., @readme will show files containing 'readme')."
          }
        </Text>
      </Box>
      <OutputDisplay output={output} />
      <InputPrompt
        input={input}
        isExecuting={isExecuting}
        example={showExamples ? "/examples" : undefined}
      />
      <FileSearch
        fileMatches={fileMatches}
        selectedIndex={selectedFileIndex}
        isVisible={showingFiles}
      />
    </Box>
  );
};

const App: React.FC = () => {
  const handleReady = useCallback(async () => {
    try {
      if (!isServerRunning()) {
        await startServerInBackground();
      }
    } catch {
      // best-effort startup; ignore errors here to avoid blocking the UI
    }
  }, []);

  useEffect(() => {
    return () => {
      // best-effort shutdown on app exit
      void stopServer();
    };
  }, []);

  return (
    <VenvSetupGate onReady={handleReady}>
      <MainUI />
    </VenvSetupGate>
  );
};

export default App;
