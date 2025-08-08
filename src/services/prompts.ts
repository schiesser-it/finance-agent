import { existsSync } from "node:fs";
import path from "node:path";

export const NOTEBOOK_FILE = "analysis.ipynb";
const ADD_GRAPH_PROMPT = "Make sure to tell a story and add supporting visual pleasing graphs.";

export const buildPromptWithNotebookPrefix = (userPrompt: string): string => {
  const notebookPath = path.resolve(process.cwd(), NOTEBOOK_FILE);
  const prefix = existsSync(notebookPath)
    ? `update the jupyter notebook named ${NOTEBOOK_FILE}. ${ADD_GRAPH_PROMPT}`
    : `create a jupyter notebook named ${NOTEBOOK_FILE}. ${ADD_GRAPH_PROMPT}`;
  return `${prefix} ${userPrompt}`;
};

export const SYSTEM_PROMPT = `You are a senior equity research analyst at Goldman Sachs with 15 years experience and you are an expert in creating Jupyter notebooks using Python.`;
