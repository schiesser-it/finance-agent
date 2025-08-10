import { Box, useInput, useApp, Text } from "ink";
import type { Key } from "ink";
import React, { useCallback, useEffect } from "react";

import ExamplesList from "./components/ExamplesList.js";
import FileSearch from "./components/FileSearch.js";
import Header from "./components/Header.js";
import InputPrompt from "./components/InputPrompt.js";
import LoginPrompt from "./components/LoginPrompt.js";
import OutputDisplay from "./components/OutputDisplay.js";
import VenvSetupGate from "./components/VenvSetupGate.js";
import { useCommands } from "./hooks/useCommands.js";
import { useExamples } from "./hooks/useExamples.js";
import { useFileSearch } from "./hooks/useFileSearch.js";
import { useInputState } from "./hooks/useInput.js";
import { setAnthropicApiKeyForSessionAndPersist } from "./services/config.js";
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

  const {
    examples,
    isShowingExamples,
    selectedExampleIndex,
    showExamples,
    hideExamples,
    selectPreviousExample,
    selectNextExample,
    handleExampleSelection,
  } = useExamples();

  const { output, handleCommand, executePrompt, abortExecution, appendOutput, runningCommand } =
    useCommands();

  const {
    input,
    clearInput,
    trimmedInput,
    showExamplesHint,
    addCharacter,
    removeLastCharacter,
    insertFileReference,
    pushHistory,
    historyPrev,
    historyNext,
  } = useInputState();

  useEffect(() => {
    updateFileMatches(input);
  }, [input, updateFileMatches]);

  const handleFileSelection = () => {
    if (fileMatches.length > 0) {
      insertFileReference(fileMatches[selectedFileIndex].path);
      clearFileSearch();
    }
  };

  const onExampleSelected = (selected: string) => {
    executePrompt(selected);
    pushHistory(selected);
    clearInput();
  };

  const handleInputSubmission = () => {
    const effectiveInput = showExamplesHint ? "/examples" : trimmedInput;

    if (effectiveInput.length === 0) {
      clearInput();
      return;
    }

    if (effectiveInput.startsWith("/")) {
      // Special-case /examples to open the examples picker
      if (effectiveInput === "/examples") {
        showExamples();
        return;
      }
      handleCommand(effectiveInput);
    } else {
      executePrompt(effectiveInput);
    }

    pushHistory(effectiveInput);
    clearInput();
  };

  useInput((inputChar: string, key: Key) => {
    if (key.ctrl && inputChar === "c") {
      if (runningCommand !== null) {
        abortExecution();
        return;
      }
      exit();
      return;
    }

    if (runningCommand !== null) {
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

    if (isShowingExamples) {
      if (key.upArrow) {
        selectPreviousExample();
        return;
      }
      if (key.downArrow) {
        selectNextExample();
        return;
      }
      if (key.return || key.tab) {
        handleExampleSelection(onExampleSelected);
        return;
      }
      if (key.escape) {
        hideExamples();
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
        isExecuting={runningCommand !== null}
        example={showExamplesHint ? "/examples" : undefined}
      />
      <LoginPrompt
        visible={runningCommand === "login"}
        onSubmit={(key) => {
          setAnthropicApiKeyForSessionAndPersist(key);
          abortExecution();
          appendOutput("✅ API key saved. You can now use the agent.");
        }}
        onCancel={() => {
          abortExecution();
          appendOutput("Login cancelled.");
        }}
      />
      {isShowingExamples && (
        <ExamplesList examples={examples} selectedIndex={selectedExampleIndex} />
      )}
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
