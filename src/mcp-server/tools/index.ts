import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pdfReaderTools } from "./pdfReader";

/**
 * Register all tools with the MCP server
 */
export async function registerAllTools(server: McpServer): Promise<void> {
  console.error("📦 Registering tools...");
  
  try {
    // Register PDF reader tools
    await registerToolCategory(server, "PDF Tools", pdfReaderTools);
    
    console.error("✅ All tools registered successfully");
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
  tools: Record<string, any>
): Promise<void> {
  console.error(`  📋 Registering ${categoryName}...`);
  
  for (const [toolName, toolConfig] of Object.entries(tools)) {
    try {
      server.registerTool(
        toolName,
        toolConfig.schema,
        toolConfig.handler
      );
      console.error(`    ✓ ${toolName}`);
    } catch (error) {
      console.error(`    ❌ Failed to register ${toolName}:`, error);
      throw error;
    }
  }
}
