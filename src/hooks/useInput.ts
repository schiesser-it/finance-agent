import { useState, useCallback, useMemo } from "react";

import { COMMANDS } from "../services/commands.js";

export const useInputState = () => {
  const [input, setInput] = useState("");
  const [firstCommand, setFirstCommand] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftBeforeHistory, setDraftBeforeHistory] = useState<string>("");
  const [showingCommandCompletions, setShowingCommandCompletions] = useState(false);
  const [commandMatches, setCommandMatches] = useState<string[]>([]);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const clearInput = useCallback(() => {
    setInput("");
    setFirstCommand(false);
  }, []);

  const trimmedInput = useMemo(() => input.trim(), [input]);
  const showExamplesHint = useMemo(
    () => firstCommand && trimmedInput.length === 0,
    [firstCommand, trimmedInput],
  );

  const addCharacter = useCallback((char: string) => {
    setHistoryIndex(null);
    setInput((prev) => prev + char);
  }, []);

  const removeLastCharacter = useCallback(() => {
    setHistoryIndex(null);
    setInput((prev) => prev.slice(0, -1));
  }, []);

  const pushHistory = useCallback((entry: string) => {
    const trimmed = entry.trim();
    if (trimmed.length === 0) return;
    setHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === trimmed) return prev;
      return [...prev, trimmed];
    });
    setHistoryIndex(null);
    setDraftBeforeHistory("");
  }, []);

  const updateCommandMatches = useCallback(
    (text: string) => {
      // When navigating command history, do not show command completions
      if (historyIndex !== null) {
        setShowingCommandCompletions(false);
        setCommandMatches([]);
        return;
      }
      if (!text.startsWith("/")) {
        setShowingCommandCompletions(false);
        setCommandMatches([]);
        setSelectedCommandIndex(0);
        return;
      }
      // If user started typing arguments, don't show command matches
      if (text.includes(" ")) {
        setShowingCommandCompletions(false);
        setCommandMatches([]);
        setSelectedCommandIndex(0);
        return;
      }
      const [cmdPart] = text.split(/\s+/, 1);
      // Prefer exact match first to avoid selecting a longer prefix match (e.g., /mode vs /model)
      const matches = COMMANDS.filter((c) => c.name.startsWith(cmdPart))
        .map((c) => c.name)
        .sort((a, b) => {
          if (a === cmdPart && b !== cmdPart) return -1;
          if (b === cmdPart && a !== cmdPart) return 1;
          return 0;
        });
      setCommandMatches(matches);
      setShowingCommandCompletions(matches.length > 0 && cmdPart.length > 0);
      setSelectedCommandIndex(0);
    },
    [historyIndex],
  );

  const selectPreviousCommand = useCallback(() => {
    setSelectedCommandIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const selectNextCommand = useCallback(() => {
    setSelectedCommandIndex((prev) => Math.min(commandMatches.length - 1, prev + 1));
  }, [commandMatches.length]);

  const applySelectedCommand = useCallback(() => {
    if (commandMatches.length === 0) return;
    const current = commandMatches[selectedCommandIndex];
    const completed = buildCompletedCommand(current, input, true);
    setInput(completed);
    setShowingCommandCompletions(false);
  }, [commandMatches, selectedCommandIndex, input]);

  const buildCompletedCommand = (
    base: string,
    currentInput: string,
    withTrailingSpace: boolean,
  ): string => {
    const parts = currentInput.split(/\s+/, 2);
    const rest = parts.length > 1 ? ` ${parts[1]}` : "";
    if (withTrailingSpace) {
      return `${base}${rest || " "}`;
    }
    return `${base}${rest}`;
  };

  const getSelectedCommandEffectiveInput = useCallback((): string | null => {
    if (commandMatches.length === 0) return null;
    const base = commandMatches[selectedCommandIndex] ?? "";
    return buildCompletedCommand(base, input, false);
  }, [commandMatches, selectedCommandIndex, input]);

  const commitSelectedCommand = useCallback((): string | null => {
    const effectiveInput = getSelectedCommandEffectiveInput();
    if (!effectiveInput) return null;
    setShowingCommandCompletions(false);
    // push to history and clear input using existing helpers
    pushHistory(effectiveInput);
    setHistoryIndex(null);
    setDraftBeforeHistory("");
    setInput("");
    setFirstCommand(false);
    return effectiveInput;
  }, [getSelectedCommandEffectiveInput, pushHistory]);

  const insertFileReference = useCallback((filePath: string) => {
    setInput((prevInput) => {
      const atIndex = prevInput.lastIndexOf("@");

      if (atIndex !== -1) {
        const beforeAt = prevInput.substring(0, atIndex);
        const afterAt = prevInput.substring(
          prevInput.indexOf(" ", atIndex) !== -1
            ? prevInput.indexOf(" ", atIndex)
            : prevInput.length,
        );
        return `${beforeAt}@${filePath} ${afterAt}`;
      }

      return prevInput;
    });
  }, []);

  const historyPrev = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      if (history.length === 0) return null;
      if (currentIndex === null) {
        setDraftBeforeHistory((prevDraft) => (prevDraft === "" ? input : prevDraft));
        const newIndex = history.length - 1;
        setInput(history[newIndex] ?? "");
        setShowingCommandCompletions(false);
        return newIndex;
      }
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        setInput(history[newIndex] ?? "");
        setShowingCommandCompletions(false);
        return newIndex;
      }
      // Already at oldest
      return currentIndex;
    });
  }, [history, input]);

  const historyNext = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      if (history.length === 0 || currentIndex === null) return currentIndex;
      if (currentIndex < history.length - 1) {
        const newIndex = currentIndex + 1;
        setInput(history[newIndex] ?? "");
        setShowingCommandCompletions(false);
        return newIndex;
      }
      // Move past the newest back to draft state
      setInput(draftBeforeHistory);
      setShowingCommandCompletions(false);
      return null;
    });
  }, [history, draftBeforeHistory]);

  return {
    input,
    setInput,
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
    historyIndex,
    showingCommandCompletions,
    setShowingCommandCompletions,
    commandMatches,
    selectedCommandIndex,
    selectPreviousCommand,
    selectNextCommand,
    applySelectedCommand,
    getSelectedCommandEffectiveInput,
    commitSelectedCommand,
  };
};
