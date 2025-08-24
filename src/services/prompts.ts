import { existsSync } from "node:fs";
import path from "node:path";

import { getInvocationCwd, readThinkingModeFromConfig } from "./config.js";

export const NOTEBOOK_FILE = "analysis.ipynb";
export const DASHBOARD_FILE = "dashboard.py";
const ADD_GRAPH_PROMPT =
  "Make sure to tell a story and add supporting visual pleasing graphs using plotly.";
const YFINANCE_PROMPT =
  "When using yfinance, auto_adjust=True is now the default. This means that 'Open', 'High', 'Low', and 'Close' columns are all automatically adjusted for stock splits and dividends. No need to use e.g. 'Adj Close' anymore.";
const PDF_PROMPT =
  "When working with PDF, use PDF extractor tool to get the content or tabular data instead of `Read` tool.";

export const buildPromptWithNotebookPrefix = (userPrompt: string): string => {
  const notebookPath = path.resolve(getInvocationCwd(), NOTEBOOK_FILE);
  const guidance = `${ADD_GRAPH_PROMPT} ${YFINANCE_PROMPT} ${PDF_PROMPT}`;
  const prefix = existsSync(notebookPath)
    ? `update the jupyter notebook named ${NOTEBOOK_FILE}. ${guidance}`
    : `create a jupyter notebook named ${NOTEBOOK_FILE}. ${guidance}`;
  const thinking = readThinkingModeFromConfig();
  let postfix = "";
  if (thinking === "normal") postfix = " think";
  if (thinking === "hard") postfix = " think hard";
  if (thinking === "harder") postfix = " think harder";
  return `${prefix} ${userPrompt}${postfix}`;
};

export const buildPromptWithDashboardPrefix = (userPrompt: string): string => {
  const dashboardPath = path.resolve(getInvocationCwd(), DASHBOARD_FILE);
  const guidance = `Use Plotly for charts. Ensure a professional Streamlit layout with header, optional KPI row with trend arrows (green up for positive, red down for negative), a grid of up to four best charts, and a concluding summary. Keep card heights uniform and show two decimal places for trends. ${YFINANCE_PROMPT} ${PDF_PROMPT}`;
  const prefix = existsSync(dashboardPath)
    ? `update the Streamlit dashboard named ${DASHBOARD_FILE}. ${guidance}`
    : `create a Streamlit dashboard named ${DASHBOARD_FILE}. ${guidance}`;
  const thinking = readThinkingModeFromConfig();
  let postfix = "";
  if (thinking === "normal") postfix = " think";
  if (thinking === "hard") postfix = " think hard";
  if (thinking === "harder") postfix = " think harder";
  return `${prefix} ${userPrompt}${postfix}`;
};

export const buildNotebookToDashboardPrompt = (): string => {
  return `Convert the notebook \`@${NOTEBOOK_FILE}\` into a professional Streamlit dashboard with this layout:\n\n## Layout Structure\n- **Header**: Title and Date\n    - Title: left\n    - Date: right\n- **KPI Row**: (if the notebook contains any KPIs)\n    - Use red for negative trends and green for positive trend\n- **Charts Grid**:\n    - Use the four best charts from the notebook\n- **Bottom Row**: \n   - Add summary or conclusion of the notebook if available\n\n## Key Requirements\n- Generate the code in a single file called \`${DASHBOARD_FILE}\`\n- Use Plotly for all charts\n- Professional styling with trend arrows/colors\n- Use uniform card heights for each row\n- Show two decimal places for each trend indicator`;
};

export const buildDashboardToNotebookPrompt = (): string => {
  return `Convert the Streamlit dashboard \`@${DASHBOARD_FILE}\` into a Jupyter notebook named \`${NOTEBOOK_FILE}\` with equivalent analysis, clean markdown explanations, and Plotly charts. Preserve data loading and processing logic.`;
};

export const SYSTEM_PROMPT = `You are a senior equity research analyst at Goldman Sachs with 15 years experience and an expert in writing financial analysis code in Python.`;
