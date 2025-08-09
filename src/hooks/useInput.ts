import { useState, useCallback } from "react";

export const useInputState = () => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [, setHistoryIndex] = useState<number | null>(null);
  const [draftBeforeHistory, setDraftBeforeHistory] = useState<string>("");

  const clearInput = useCallback(() => {
    setInput("");
  }, []);

  const addCharacter = useCallback((char: string) => {
    setInput((prev) => prev + char);
  }, []);

  const removeLastCharacter = useCallback(() => {
    setInput((prev) => prev.slice(0, -1));
  }, []);

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

  const historyPrev = useCallback(() => {
    setHistoryIndex((currentIndex) => {
      if (history.length === 0) return null;
      if (currentIndex === null) {
        setDraftBeforeHistory((prevDraft) => (prevDraft === "" ? input : prevDraft));
        const newIndex = history.length - 1;
        setInput(history[newIndex] ?? "");
        return newIndex;
      }
      if (currentIndex > 0) {
        const newIndex = currentIndex - 1;
        setInput(history[newIndex] ?? "");
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
        return newIndex;
      }
      // Move past the newest back to draft state
      setInput(draftBeforeHistory);
      return null;
    });
  }, [history, draftBeforeHistory]);

  return {
    input,
    setInput,
    clearInput,
    addCharacter,
    removeLastCharacter,
    insertFileReference,
    pushHistory,
    historyPrev,
    historyNext,
  };
};
