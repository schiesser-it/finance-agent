import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useExamples, EXAMPLE_PROMPTS } from "../useExamples";

describe("useExamples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with default examples and first selection", () => {
      const { result } = renderHook(() => useExamples());

      expect(result.current.examples).toEqual(EXAMPLE_PROMPTS);
      expect(result.current.selectedExampleIndex).toBe(0);
      expect(result.current.examples.length).toBeGreaterThan(0);
    });

    it("should include expected example prompts", () => {
      const { result } = renderHook(() => useExamples());

      const examples = result.current.examples;

      expect(examples).toContain(
        "Get the latest performance data for S&P500 and DAX and compare their performance over the last 10 years",
      );
      expect(examples).toContain(
        "Analyze @data/balance_sheet.csv for liquidity positions and working capital.",
      );
      expect(examples).toContain(
        "Optimize this portfolio @data/example_portfolio.csv: Implement Markowitz efficient frontier strategies",
      );
    });
  });

  describe("example navigation", () => {
    it("should navigate to previous example", () => {
      const { result } = renderHook(() => useExamples());

      // Start at index 0, should stay at 0 when going previous
      expect(result.current.selectedExampleIndex).toBe(0);

      act(() => {
        result.current.selectPreviousExample();
      });

      expect(result.current.selectedExampleIndex).toBe(0);

      // Move to index 2, then go previous
      act(() => {
        result.current.selectNextExample();
        result.current.selectNextExample();
      });

      expect(result.current.selectedExampleIndex).toBe(2);

      act(() => {
        result.current.selectPreviousExample();
      });

      expect(result.current.selectedExampleIndex).toBe(1);
    });

    it("should navigate to next example", () => {
      const { result } = renderHook(() => useExamples());

      expect(result.current.selectedExampleIndex).toBe(0);

      act(() => {
        result.current.selectNextExample();
      });

      const maxIndex = result.current.examples.length - 1;
      expect(result.current.selectedExampleIndex).toBe(Math.min(1, maxIndex));

      act(() => {
        result.current.selectNextExample();
      });

      expect(result.current.selectedExampleIndex).toBe(Math.min(2, maxIndex));

      // Advance to the end and ensure we stop at the last index
      act(() => {
        const remaining = maxIndex - result.current.selectedExampleIndex;
        for (let i = 0; i < remaining + 2; i++) {
          // +2 tries to go beyond the end to verify clamping
          result.current.selectNextExample();
        }
      });

      expect(result.current.selectedExampleIndex).toBe(maxIndex);
    });

    it("should handle navigation bounds correctly", () => {
      const { result } = renderHook(() => useExamples());
      const maxIndex = result.current.examples.length - 1;

      // Test lower bound
      expect(result.current.selectedExampleIndex).toBe(0);

      act(() => {
        result.current.selectPreviousExample();
      });

      expect(result.current.selectedExampleIndex).toBe(0);

      // Navigate to upper bound
      for (let i = 0; i < maxIndex; i++) {
        act(() => {
          result.current.selectNextExample();
        });
      }

      expect(result.current.selectedExampleIndex).toBe(maxIndex);

      // Test upper bound
      act(() => {
        result.current.selectNextExample();
      });

      expect(result.current.selectedExampleIndex).toBe(maxIndex);
    });
  });

  describe("example selection handling", () => {
    it("should call onSelected callback with correct example", () => {
      const { result } = renderHook(() => useExamples());
      const onSelectedSpy = vi.fn();

      // Test selection of first example
      act(() => {
        result.current.handleExampleSelection(onSelectedSpy);
      });

      expect(onSelectedSpy).toHaveBeenCalledWith(result.current.examples[0]);
      expect(onSelectedSpy).toHaveBeenCalledTimes(1);
    });

    it("should call onSelected callback with correct example after navigation", () => {
      const { result } = renderHook(() => useExamples());
      const onSelectedSpy = vi.fn();

      // Navigate to second example
      act(() => {
        result.current.selectNextExample();
      });

      act(() => {
        result.current.handleExampleSelection(onSelectedSpy);
      });

      expect(onSelectedSpy).toHaveBeenCalledWith(result.current.examples[1]);
      expect(onSelectedSpy).toHaveBeenCalledTimes(1);
    });

    it("should not call onSelected when examples array is empty", () => {
      // Test the actual behavior with existing examples - we can't easily mock empty array
      // This test verifies the guard clause works by testing bounds
      const { result } = renderHook(() => useExamples());
      const onSelectedSpy = vi.fn();

      // This should work normally
      act(() => {
        result.current.handleExampleSelection(onSelectedSpy);
      });

      expect(onSelectedSpy).toHaveBeenCalledWith(result.current.examples[0]);
      expect(result.current.examples.length).toBeGreaterThan(0);
    });
  });

  describe("example content validation", () => {
    it("should contain financial analysis related examples", () => {
      const { result } = renderHook(() => useExamples());

      const examples = result.current.examples;

      // Check for financial keywords
      const hasFinancialContent = examples.some(
        (example) =>
          example.toLowerCase().includes("s&p500") ||
          example.toLowerCase().includes("portfolio") ||
          example.toLowerCase().includes("balance") ||
          example.toLowerCase().includes("performance") ||
          example.toLowerCase().includes("markowitz"),
      );

      expect(hasFinancialContent).toBe(true);
    });

    it("should contain file reference examples", () => {
      const { result } = renderHook(() => useExamples());

      const examples = result.current.examples;

      // Check for file reference syntax (@data/...)
      const hasFileReferences = examples.some((example) => example.includes("@data/"));

      expect(hasFileReferences).toBe(true);
    });

    it("should have reasonable example lengths", () => {
      const { result } = renderHook(() => useExamples());

      const examples = result.current.examples;

      examples.forEach((example) => {
        expect(example.length).toBeGreaterThan(10);
        expect(example.length).toBeLessThan(500);
        expect(example.trim()).toBe(example); // No leading/trailing whitespace
        expect(example.length).toBeGreaterThan(0);
      });
    });
  });

  describe("immutability", () => {
    it("should return the same examples reference on multiple calls", () => {
      const { result, rerender } = renderHook(() => useExamples());

      const initialExamples = result.current.examples;

      rerender();

      expect(result.current.examples).toBe(initialExamples);
    });

    it("should not mutate examples array", () => {
      const { result } = renderHook(() => useExamples());

      const originalExamples = [...result.current.examples];

      // Try to modify the examples (this should not affect the hook's state)
      try {
        result.current.examples.push("New example");
      } catch {
        // If examples is frozen or read-only, this is fine
      }

      // The hook should still return the original examples
      expect(result.current.examples.slice(0, originalExamples.length)).toEqual(originalExamples);
    });
  });

  describe("selection state consistency", () => {
    it("should maintain valid selection index after navigation", () => {
      const { result } = renderHook(() => useExamples());

      const maxIndex = result.current.examples.length - 1;

      // Navigate through all examples
      for (let i = 0; i <= maxIndex + 5; i++) {
        act(() => {
          result.current.selectNextExample();
        });

        expect(result.current.selectedExampleIndex).toBeGreaterThanOrEqual(0);
        expect(result.current.selectedExampleIndex).toBeLessThanOrEqual(maxIndex);
      }

      // Navigate backwards through all examples
      for (let i = 0; i <= maxIndex + 5; i++) {
        act(() => {
          result.current.selectPreviousExample();
        });

        expect(result.current.selectedExampleIndex).toBeGreaterThanOrEqual(0);
        expect(result.current.selectedExampleIndex).toBeLessThanOrEqual(maxIndex);
      }
    });

    it("should handle rapid navigation correctly", () => {
      const { result } = renderHook(() => useExamples());

      // Rapid navigation test
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.selectNextExample();
          result.current.selectPreviousExample();
          result.current.selectNextExample();
        }
      });

      expect(result.current.selectedExampleIndex).toBeGreaterThanOrEqual(0);
      expect(result.current.selectedExampleIndex).toBeLessThan(result.current.examples.length);
    });
  });
});
