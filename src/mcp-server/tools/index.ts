import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { newsReaderTools } from "./newsReader";
import { ToolConfig } from "./types";

/**
 * Register all tools with the MCP server
 */
export async function registerAllTools(server: McpServer): Promise<void> {
  console.error("📦 Registering tools...");

  try {
    // Register News Reader tools
    await registerToolCategory(server, "News Reader", newsReaderTools);

    console.log("✅ All tools registered successfully");
  } catch (error) {
    console.error("❌ Error registering tools:", error);
    throw error;
  }
}

/**
 * Register a category of tools
 */
async function registerToolCategory(
  server: McpServer,
  categoryName: string,
  tools: Record<string, ToolConfig>,
): Promise<void> {
  console.error(`  📋 Registering ${categoryName}...`);

  for (const [toolName, toolConfig] of Object.entries(tools)) {
    try {
      server.registerTool(toolName, toolConfig.schema, toolConfig.handler);
      console.log(`    ✓ ${toolName}`);
    } catch (error) {
      console.error(`    ❌ Failed to register ${toolName}:`, error);
      throw error;
    }
  }
}
