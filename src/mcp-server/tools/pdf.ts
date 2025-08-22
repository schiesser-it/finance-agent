/* eslint-disable @typescript-eslint/no-explicit-any */
import { LlamaParseReader } from "llama-cloud-services";
import { z } from "zod";

import { ToolConfig } from "./types";

export const pdfTools: Record<string, ToolConfig> = {
  pdf_csv_extractor: {
    schema: {
      title: "Extract table in PDF to CSV",
      description: `Extracts tables from a PDF file and returns them in CSV format. Use this tool to extract tabular data from PDFs.`,
      inputSchema: {
        pdf_file_path: z.string().describe("Path to the PDF file to extract tables from."),
        pdf_pages: z
          .object({
            start: z.number().int().describe("The start page number (inclusive)."),
            end: z.number().int().describe("The end page number (inclusive)."),
          })
          .describe("Page range to extract tables from."),
      },
    },
    handler: async (args) => {
      const { pdf_file_path, pdf_pages } = args as {
        pdf_file_path: string;
        pdf_pages: { start: number; end: number };
      };

      if (!pdf_file_path || !pdf_pages) {
        throw new Error("Missing required parameters");
      }

      const reader = new LlamaParseReader({
        apiKey: process.env.LLAMACLOUD_API_KEY,
        targetPages: `${pdf_pages.start}-${pdf_pages.end}`,
      });

      try {
        return reader.loadJson(pdf_file_path).then((result: any) => {
          const document = result[0];
          if (!document) {
            throw new Error("Failed to load document");
          }
          const tablePages = document.pages.filter((page: any) => {
            return page.items.some((item: any) => item.type === "table");
          });

          const tables = tablePages.map((page: any) => {
            const res = [];
            for (let i = 0; i < page.items.length; i++) {
              const item = page.items[i];
              if (item.type === "table") {
                const heading =
                  i > 0 && page.items[i - 1].type === "heading"
                    ? page.items[i - 1].text
                    : "Untitled";
                res.push({
                  page: page.page,
                  content: item.csv,
                  heading,
                });
              }
            }
            return res;
          });

          return {
            content: tables.flat().map((table) => ({
              type: "text",
              text: `Page: ${table.page}\nHeading: ${table.heading}\nContent:\n${table.content}`,
            })),
          };
        });
      } catch (error) {
        console.error("Error extracting tables from PDF:", error);
        throw new Error("Failed to extract tables from PDF");
      }
    },
  },
};
