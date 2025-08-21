import { ToolConfig } from "./types";
import {
  LlamaParseReader,
} from "llama-cloud-services";

export const pdfTools: Record<string, ToolConfig> = {
  pdf_csv_extractor: {
    schema: {
      title: "Extract table in PDF to CSV",
      description: `Extracts tables from a PDF file and returns them in CSV format. Use this tool to extract tabular data from PDFs.`,
      inputSchema: {
        type: "object",
        properties: {
          pdf_file_path: {
            type: "string",
            description: "Path to the PDF file to extract tables from."
          },
          pages: {
            type: "object",
            properties: {
              start: {
                type: "integer",
                description: "The start page number (inclusive)."
              },
              end: {
                type: "integer", 
                description: "The end page number (inclusive)."
              }
            },
            required: ["start", "end"]
          }
        },
        required: ["pdf_file_path", "pages"]
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const { pdf_file_path, pages } = args as { pdf_file_path: string; pages: { start: number; end: number } };
      const reader = new LlamaParseReader({
        apiKey: process.env.LLAMACLOUD_API_KEY,
        targetPages: `${pages.start}-${pages.end}`
      });
      const result = await reader.loadJson(pdf_file_path);
      const document = result[0];
      const tablePages = document.pages.filter((page: any) => {
        return page.items.some((item: any) => item.type === "table");
      });
      
      const tables = tablePages.map((page: any) => {
        const res = [];
        for (let i = 0; i < page.items.length; i++) {
          const item = page.items[i];
          if (item.type === "table") {
            const heading = i > 0 && page.items[i - 1].type === "heading"
              ? page.items[i - 1].text
              : "Untitled";
            console.log("Item:", item);
            res.push({
              page: page.page,
              content: item.csv,
              heading
            });
          }
        }
        return res;
      });

      return {
        content: tables.flat().map(table => ({
          type: "text",
          text: `Page: ${table.page}\nHeading: ${table.heading}\nContent:\n${table.content}`
        })),
      };
    }
  }
};
