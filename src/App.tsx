import { Box, useInput, useApp, Text } from "ink";
import type { Key } from "ink";
import React, { useEffect } from "react";

import CommandCompletions from "./components/CommandCompletions.js";
import ConfirmPrompt from "./components/ConfirmPrompt.js";
import ExamplesList from "./components/ExamplesList.js";
import ExecutingPrompt from "./components/ExecutingPrompt.js";
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
import { stopAllManagedProcesses } from "./services/processLifecycle.js";

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
    selectedExampleIndex,
    selectPreviousExample,
    selectNextExample,
    handleExampleSelection,
  } = useExamples();

  const {
    output,
    handleCommand,
    executePrompt,
    abortExecution,
    appendOutput,
    runningCommand,
    confirmPendingAction,
    cancelPendingAction,
    pendingAction,
  } = useCommands();

  const {
    input,
    clearInput,
    trimmedInput,
    showExamplesHint,
    addCharacter,
    removeLastCharacter,
    updateCommandMatches,
    insertFileReference,
    pushHistory,
    historyPrev,
    historyNext,
    showingCommandCompletions,
    setShowingCommandCompletions,
    commandMatches,
    selectedCommandIndex,
    selectPreviousCommand,
    selectNextCommand,
    applySelectedCommand,
    commitSelectedCommand,
  } = useInputState();

  useEffect(() => {
    updateFileMatches(input);
    updateCommandMatches(input);
  }, [input, updateFileMatches, updateCommandMatches]);

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

    if (showingCommandCompletions) {
      if (key.escape) {
        setShowingCommandCompletions(false);
        return;
      }
      if (key.upArrow) {
        selectPreviousCommand();
        return;
      }
      if (key.downArrow) {
        selectNextCommand();
        return;
      }
      if (key.tab) {
        applySelectedCommand();
        return;
      }
      if (key.return) {
        const committed = commitSelectedCommand();
        if (committed) {
          handleCommand(committed);
        }
        return;
      }
    }

    if (runningCommand === "examples") {
      if (key.escape) {
        abortExecution();
        return;
      }
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
    }

    if (runningCommand !== null) {
      return;
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
      {runningCommand === null && (
        <InputPrompt input={input} example={showExamplesHint ? "/examples" : undefined} />
      )}
      {runningCommand === "execute" && <ExecutingPrompt />}
      <CommandCompletions
        commandMatches={commandMatches}
        selectedIndex={selectedCommandIndex}
        isVisible={showingCommandCompletions}
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
      <ConfirmPrompt
        visible={runningCommand === "confirm"}
        message={
          pendingAction && pendingAction.kind === "convert"
            ? `Convert existing ${pendingAction.from} to ${pendingAction.to} now?`
            : pendingAction && pendingAction.kind === "auto-fix-error"
              ? `Error detected. Attempt an automatic fix now?`
              : ""
        }
        onConfirm={confirmPendingAction}
        onCancel={cancelPendingAction}
      />
      {runningCommand === "examples" && (
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
  useEffect(() => {
    return () => {
      // best-effort shutdown on app exit
      void stopAllManagedProcesses({
        onMessage: (line: string) => {
          console.log(line);
        },
      });
    };
  }, []);

  return (
    <VenvSetupGate
      onReady={() => {
        stopAllManagedProcesses();
      }}
    >
      <MainUI />
    </VenvSetupGate>
  );
};

export default App;
