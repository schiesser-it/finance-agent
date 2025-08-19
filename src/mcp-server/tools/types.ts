import type { z } from "zod";

/**
 * Configuration for an MCP tool
 */
export interface ToolConfig {
  schema: {
    title: string;
    description: string;
    inputSchema: Record<string, z.ZodType<any>>;
  };
  handler: (args: any) => Promise<{
    content: Array<{
      type: string;
      text: string;
    }>;
    isError?: boolean;
  }>;
}

/**
 * Configuration for an MCP resource
 */
export interface ResourceConfig {
  template: string;
  metadata: {
    title: string;
    description: string;
    mimeType?: string;
  };
  handler: (uri: URL, params: Record<string, string>) => Promise<{
    contents: Array<{
      uri: string;
      text: string;
      mimeType?: string;
    }>;
  }>;
}

/**
 * Configuration for an MCP prompt
 */
export interface PromptConfig {
  metadata: {
    title: string;
    description: string;
    argsSchema: Record<string, z.ZodType<any>>;
  };
  handler: (args: any) => {
    messages: Array<{
      role: string;
      content: {
        type: string;
        text: string;
      };
    }>;
  };
}

/**
 * Server capabilities and configuration
 */
export interface ServerConfig {
  name: string;
  version: string;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };
}

/**
 * Tool categories for organization
 */
export type ToolCategory = "joke" | "finance" | "utility" | "analysis" | "market-data";

/**
 * Resource categories for organization  
 */
export type ResourceCategory = "data" | "reports" | "documentation" | "templates";

/**
 * Prompt categories for organization
 */
export type PromptCategory = "analysis" | "reporting" | "planning" | "general";
