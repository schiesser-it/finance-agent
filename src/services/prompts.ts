import { existsSync } from "node:fs";
import path from "node:path";

export const NOTEBOOK_FILE = "analysis.ipynb";
const ADD_GRAPH_PROMPT = "Make sure to tell a story and add supporting visual pleasing graphs.";
const YFINANCE_PROMPT =
  "When using yfinance, auto_adjust=True is now the default. This means that 'Open', 'High', 'Low', and 'Close' columns are all automatically adjusted for stock splits and dividends. No need to use e.g. 'Adj Close' anymore.";

export const buildPromptWithNotebookPrefix = (userPrompt: string): string => {
  const notebookPath = path.resolve(process.cwd(), NOTEBOOK_FILE);
  const prefix = existsSync(notebookPath)
    ? `update the jupyter notebook named ${NOTEBOOK_FILE}. ${ADD_GRAPH_PROMPT} ${YFINANCE_PROMPT}`
    : `create a jupyter notebook named ${NOTEBOOK_FILE}. ${ADD_GRAPH_PROMPT} ${YFINANCE_PROMPT}`;
  return `${prefix} ${userPrompt}`;
};

export const SYSTEM_PROMPT = `You are a senior equity research analyst at Goldman Sachs with 15 years experience and you are an expert in creating Jupyter notebooks using Python.`;
