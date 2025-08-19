import { useCallback, useMemo, useState } from "react";

export const EXAMPLE_PROMPTS: string[] = [
  "Get the latest performance data for S&P500 and DAX and compare their performance over the last 10 years",
  "Analyze @data/balance_sheet.csv for liquidity positions and working capital.",
  "Optimize this portfolio @data/example_portfolio.csv: Implement Markowitz efficient frontier strategies",
  `Compare these two investment plans under different inflation and return scenarios: @data/investment_plan1.csv and @data/investment_plan2.csv . Assume a fixed amount investment of $1,000/month spread according to allocation.`,
  "Analyze ROI of Databricks based on @data/databricks.csv and compare it with S&P 500 and Nasdaq investments",
];

export const useExamples = () => {
  const [selectedExampleIndex, setSelectedExampleIndex] = useState<number>(0);

  const examples = useMemo(() => EXAMPLE_PROMPTS, []);

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
      onSelected(selected);
    },
    [examples, selectedExampleIndex],
  );

  return {
    examples,
    selectedExampleIndex,
    selectPreviousExample,
    selectNextExample,
    handleExampleSelection,
  };
};
