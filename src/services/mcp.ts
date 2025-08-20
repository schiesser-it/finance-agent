import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpStdioServerConfig } from "@anthropic-ai/claude-code";

export function createMCPServer(): Record<string, McpStdioServerConfig> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // always use compiled server (so dev is testing the release)
  // In dev mode, __dirname is src/services, so we need to go up to root then into dist
  // In prod mode, __dirname is dist, so we can use relative path
  const isInSrcDir = __dirname.includes("/src/");
  const serverPath = isInSrcDir
    ? path.resolve(__dirname, "..", "..", "dist", "mcp-server", "server.js")
    : path.resolve(__dirname, "mcp-server", "server.js");
  if (!fs.existsSync(serverPath)) {
    throw new Error(`Compiled MCP server not found in ${serverPath}. Run \`npm run build\` first.`);
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
