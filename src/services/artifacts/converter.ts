import type { GenerationMode } from "../config.js";

import { DASHBOARD_FILE } from "./DashboardArtifact.js";
import { NOTEBOOK_FILE } from "./NotebookArtifact.js";

export function buildConversionPrompt(from: GenerationMode, to: GenerationMode): string {
  if (from === "notebook" && to === "dashboard") {
    return `Convert the notebook \`@${NOTEBOOK_FILE}\` into a professional Streamlit dashboard with this layout:\n\n## Layout Structure\n- **Header**: Title and Date\n    - Title: left\n    - Date: right\n- **KPI Row**: (if the notebook contains any KPIs)\n    - Use red for negative trends and green for positive trend\n- **Charts Grid**:\n    - Use the four best charts from the notebook\n- **Bottom Row**: \n   - Add summary or conclusion of the notebook if available\n\n## Key Requirements\n- Generate the code in a single file called \`${DASHBOARD_FILE}\`\n- Use Plotly for all charts\n- Professional styling with trend arrows/colors\n- Use uniform card heights for each row\n- Show two decimal places for each trend indicator`;
  }
  if (from === "dashboard" && to === "notebook") {
    return `Convert the Streamlit dashboard \`@${DASHBOARD_FILE}\` into a Jupyter notebook named \`${NOTEBOOK_FILE}\` with equivalent analysis, clean markdown explanations, and Plotly charts. Preserve data loading and processing logic.`;
  }
  throw new Error(`Unsupported conversion: ${from} to ${to}`);
}
