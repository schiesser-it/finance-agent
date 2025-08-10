import { useCallback, useMemo, useState } from "react";

export const EXAMPLE_PROMPTS: string[] = [
  "Get the latest performance data for S&P500 and DAX and compare their performance over the last 10 years",
  "Analyze @data/balance_sheet.csv for liquidity positions and working capital.",
];

export const useExamples = () => {
  const [isShowingExamples, setIsShowingExamples] = useState<boolean>(false);
  const [selectedExampleIndex, setSelectedExampleIndex] = useState<number>(0);

  const examples = useMemo(() => EXAMPLE_PROMPTS, []);

  const showExamples = useCallback(() => {
    setIsShowingExamples(true);
    setSelectedExampleIndex(0);
  }, []);

  const hideExamples = useCallback(() => {
    setIsShowingExamples(false);
  }, []);

  const selectPreviousExample = useCallback(() => {
    setSelectedExampleIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const selectNextExample = useCallback(() => {
    setSelectedExampleIndex((prev) => Math.min(examples.length - 1, prev + 1));
  }, [examples.length]);

  const handleExampleSelection = useCallback(
    (onSelected: (example: string) => void) => {
      if (examples.length === 0) return;
      const selected = examples[selectedExampleIndex];
      setIsShowingExamples(false);
      onSelected(selected);
    },
    [examples, selectedExampleIndex],
  );

  return {
    examples,
    isShowingExamples,
    selectedExampleIndex,
    showExamples,
    hideExamples,
    selectPreviousExample,
    selectNextExample,
    handleExampleSelection,
  };
};
