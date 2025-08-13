import { existsSync } from "node:fs";
import path from "node:path";

import { getInvocationCwd, readThinkingModeFromConfig } from "./config.js";

export const NOTEBOOK_FILE = "analysis.ipynb";
const ADD_GRAPH_PROMPT =
  "Make sure to tell a story and add supporting visual pleasing graphs using plotly.";
const YFINANCE_PROMPT =
  "When using yfinance, auto_adjust=True is now the default. This means that 'Open', 'High', 'Low', and 'Close' columns are all automatically adjusted for stock splits and dividends. No need to use e.g. 'Adj Close' anymore.";

export const buildPromptWithNotebookPrefix = (
  userPrompt: string,
  options?: { includeGuidance?: boolean },
): string => {
  const includeGuidance = options?.includeGuidance !== false;
  const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
  const guidance = includeGuidance ? ` ${ADD_GRAPH_PROMPT} ${YFINANCE_PROMPT}` : "";
  const prefix = existsSync(notebookPath)
    ? `update the jupyter notebook named ${NOTEBOOK_FILE}.${guidance}`
    : `create a jupyter notebook named ${NOTEBOOK_FILE}.${guidance}`;
  const thinking = readThinkingModeFromConfig();
  let postfix = "";
  if (thinking === "normal") postfix = " think";
  if (thinking === "hard") postfix = " think hard";
  if (thinking === "harder") postfix = " think harder";
  return `${prefix} ${userPrompt}${postfix}`;
};

export const SYSTEM_PROMPT = `You are a senior equity research analyst at Goldman Sachs with 15 years experience and you are an expert in creating Jupyter notebooks using Python.`;
