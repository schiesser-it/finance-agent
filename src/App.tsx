import { Box, useInput, useApp } from "ink";
import type { Key } from "ink";
import React, { useEffect } from "react";

import FileSearch from "./components/FileSearch.js";
import Header from "./components/Header.js";
import InputPrompt from "./components/InputPrompt.js";
import OutputDisplay from "./components/OutputDisplay.js";
import { useCommands } from "./hooks/useCommands.js";
import { useFileSearch } from "./hooks/useFileSearch.js";
import { useInputState } from "./hooks/useInput.js";

const App: React.FC = () => {
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

  const { input, clearInput, addCharacter, removeLastCharacter, insertFileReference } =
    useInputState();

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
    const trimmedInput = input.trim();
    if (trimmedInput.startsWith("/")) {
      handleCommand(trimmedInput);
    } else if (trimmedInput.length > 0) {
      executePrompt(trimmedInput);
    }
    clearInput();
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

    // Block other key presses during execution
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
      <OutputDisplay output={output} />
      <InputPrompt input={input} isExecuting={isExecuting} />
      <FileSearch
        fileMatches={fileMatches}
        selectedIndex={selectedFileIndex}
        isVisible={showingFiles}
      />
    </Box>
  );
};

export default App;
