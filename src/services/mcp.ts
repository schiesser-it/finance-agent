import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpStdioServerConfig } from "@anthropic-ai/claude-code";

export function createMCPServer(): Record<string, McpStdioServerConfig> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // always use compiled server (so dev is testing the release)
  const serverPath = path.resolve(__dirname, "mcp-server", "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error("Compiled MCP server not found. Run `npm run build` first.");
  }

  return {
    "finance-agent": {
      type: "stdio",
      command: "node",
      args: [serverPath],
      env: {
        ...process.env,
        PWD: process.cwd(),
      },
    } as McpStdioServerConfig,
  };
}
