import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useInputState } from "../useInput";

describe("useInputState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic input operations", () => {
    it("should initialize with empty input", () => {
      const { result } = renderHook(() => useInputState());

      expect(result.current.input).toBe("");
      expect(result.current.trimmedInput).toBe("");
      expect(result.current.showExamplesHint).toBe(true);
    });

    it("should add characters to input", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.addCharacter("l");
        result.current.addCharacter("l");
        result.current.addCharacter("o");
      });

      expect(result.current.input).toBe("hello");
      expect(result.current.trimmedInput).toBe("hello");
    });

    it("should remove last character", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.addCharacter("l");
        result.current.removeLastCharacter();
      });

      expect(result.current.input).toBe("he");
    });

    it("should clear input", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.clearInput();
      });

      expect(result.current.input).toBe("");
      expect(result.current.showExamplesHint).toBe(false);
    });
  });

  describe("examples hint", () => {
    it("should show examples hint for first command with empty input", () => {
      const { result } = renderHook(() => useInputState());

      expect(result.current.showExamplesHint).toBe(true);
    });

    it("should hide examples hint when input is not empty", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("h");
      });

      expect(result.current.showExamplesHint).toBe(false);
    });

    it("should hide examples hint after first command", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.clearInput();
      });

      expect(result.current.showExamplesHint).toBe(false);
    });
  });

  describe("command completion", () => {
    it("should show command completions for slash commands", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("/he");
      });

      expect(result.current.showingCommandCompletions).toBe(true);
      expect(result.current.commandMatches).toEqual(["/help"]);
      expect(result.current.selectedCommandIndex).toBe(0);
    });

    it("should hide command completions for non-slash input", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("hello");
      });

      expect(result.current.showingCommandCompletions).toBe(false);
      expect(result.current.commandMatches).toEqual([]);
    });

    it("should hide command completions when command has arguments", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("/help something");
      });

      expect(result.current.showingCommandCompletions).toBe(false);
      expect(result.current.commandMatches).toEqual([]);
    });

    it("should navigate command completions", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("/");
      });

      expect(result.current.commandMatches.length).toBeGreaterThan(1);
      expect(result.current.selectedCommandIndex).toBe(0);

      act(() => {
        result.current.selectNextCommand();
      });

      expect(result.current.selectedCommandIndex).toBe(1);

      act(() => {
        result.current.selectPreviousCommand();
      });

      expect(result.current.selectedCommandIndex).toBe(0);
    });

    it("should apply selected command completion", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("/");
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.updateCommandMatches("/he");
      });

      act(() => {
        result.current.applySelectedCommand();
      });

      expect(result.current.input).toBe("/help ");
      expect(result.current.showingCommandCompletions).toBe(false);
    });

    it("should commit selected command", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("/");
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.updateCommandMatches("/he");
      });

      let committed: string | null = null;
      act(() => {
        committed = result.current.commitSelectedCommand();
      });

      expect(committed).toBe("/help");
      expect(result.current.input).toBe("");
      expect(result.current.showingCommandCompletions).toBe(false);
    });
  });

  describe("history management", () => {
    it("should add entries to history", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.pushHistory("first command");
        result.current.pushHistory("second command");
      });

      // History is internal, but we can test navigation
      act(() => {
        result.current.historyPrev();
      });

      expect(result.current.input).toBe("second command");
    });

    it("should not add duplicate consecutive entries", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.pushHistory("same command");
        result.current.pushHistory("same command");
      });

      // Navigate up twice - should only have one entry
      act(() => {
        result.current.historyPrev();
      });

      expect(result.current.input).toBe("same command");

      act(() => {
        result.current.historyPrev();
      });

      // Should still be the same command (no older entry)
      expect(result.current.input).toBe("same command");
    });

    it("should navigate history correctly", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.pushHistory("first");
        result.current.pushHistory("second");
        result.current.pushHistory("third");
        result.current.addCharacter("c");
        result.current.addCharacter("u");
        result.current.addCharacter("r");
        result.current.addCharacter("r");
      });

      // Navigate up through history
      act(() => {
        result.current.historyPrev();
      });
      expect(result.current.input).toBe("third");

      act(() => {
        result.current.historyPrev();
      });
      expect(result.current.input).toBe("second");

      act(() => {
        result.current.historyPrev();
      });
      expect(result.current.input).toBe("first");

      // Navigate back down
      act(() => {
        result.current.historyNext();
      });
      expect(result.current.input).toBe("second");

      act(() => {
        result.current.historyNext();
      });
      expect(result.current.input).toBe("third");

      // Should restore draft
      act(() => {
        result.current.historyNext();
      });
      expect(result.current.input).toBe("curr");
    });

    it("should hide command completions during history navigation", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.pushHistory("/help");
        result.current.updateCommandMatches("/he");
      });

      expect(result.current.showingCommandCompletions).toBe(true);

      act(() => {
        result.current.historyPrev();
      });

      expect(result.current.showingCommandCompletions).toBe(false);
    });
  });

  describe("file reference insertion", () => {
    it("should insert file reference at @ position", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("a");
        result.current.addCharacter("n");
        result.current.addCharacter("a");
        result.current.addCharacter("l");
        result.current.addCharacter("y");
        result.current.addCharacter("z");
        result.current.addCharacter("e");
        result.current.addCharacter(" ");
        result.current.addCharacter("@");
        result.current.insertFileReference("src/test.ts");
      });

      expect(result.current.input).toBe("analyze @src/test.ts ");
    });

    it("should handle file reference without space after @", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("@");
        result.current.insertFileReference("package.json");
      });

      expect(result.current.input).toBe("@package.json ");
    });

    it("should replace existing query after @", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter("@");
        result.current.addCharacter("p");
        result.current.addCharacter("a");
        result.current.addCharacter("c");
        result.current.insertFileReference("package.json");
      });

      expect(result.current.input).toBe("@package.json ");
    });
  });

  describe("trimmed input", () => {
    it("should trim whitespace from input", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.addCharacter(" ");
        result.current.addCharacter("h");
        result.current.addCharacter("e");
        result.current.addCharacter("l");
        result.current.addCharacter("l");
        result.current.addCharacter("o");
        result.current.addCharacter(" ");
      });

      expect(result.current.input).toBe(" hello ");
      expect(result.current.trimmedInput).toBe("hello");
    });
  });

  describe("effective input for commands", () => {
    it("should return effective input for selected command", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("/he");
      });

      const effectiveInput = result.current.getSelectedCommandEffectiveInput();
      expect(effectiveInput).toBe("/help");
    });

    it("should return null when no command matches", () => {
      const { result } = renderHook(() => useInputState());

      const effectiveInput = result.current.getSelectedCommandEffectiveInput();
      expect(effectiveInput).toBe(null);
    });

    it("should prioritize exact match for /mode over /model", () => {
      const { result } = renderHook(() => useInputState());

      act(() => {
        result.current.updateCommandMatches("/mode");
      });

      const effectiveInput = result.current.getSelectedCommandEffectiveInput();
      expect(effectiveInput).toBe("/mode");

      let committed: string | null = null;
      act(() => {
        committed = result.current.commitSelectedCommand();
      });

      expect(committed).toBe("/mode");
    });
  });
});
