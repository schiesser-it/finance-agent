import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

export class FinanceMCPServer {
  private server: McpServer;
  private transport?: StdioServerTransport;

  constructor() {
    this.server = new McpServer({
      name: "finance-agent-mcp-server",
      version: "1.0.0",
    });
  }

  async initialize(): Promise<void> {
    try {
      // Register tools only (no bullshit resources/prompts for now)
      await registerAllTools(this.server);
      
      console.error("✅ MCP server initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing MCP server:", error);
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      
      console.error("🚀 Finance Agent MCP server is running...");
    } catch (error) {
      console.error("❌ Error starting MCP server:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.transport) {
        await this.transport.close();
      }
      console.error("🛑 Finance Agent MCP server stopped");
    } catch (error) {
      console.error("❌ Error stopping MCP server:", error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const mcpServer = new FinanceMCPServer();

  // Handle graceful shutdown
  const shutdown = async () => {
    console.error("🔄 Shutting down server...");
    await mcpServer.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await mcpServer.start();
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
