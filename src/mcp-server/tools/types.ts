import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type ZodRawShape } from "zod";

/**
 * Configuration for an MCP tool
 */
export interface ToolConfig<InputArgs extends ZodRawShape = ZodRawShape> {
  schema: {
    title: string;
    description: string;
    inputSchema: InputArgs;
  };
  handler: ToolCallback<InputArgs>;
}
