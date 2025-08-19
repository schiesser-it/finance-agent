import { ToolConfig } from "./types";

export const pdfReaderTools: Record<string, ToolConfig> = {
  pdf_reader: {
    schema: {
      title: "PDF Reader",
      description:
        "Returns code snippet for PDF reading using LlamaCloud. Use this code snippet in the notebook for read a pdf file.",
      inputSchema: {},
    },
    handler: async () => {
      const codeSnippet = `from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
# pip install llama-index-indices-managed-llama-cloud

index = LlamaCloudIndex(
  name="<changeme>",
  project_name="<changeme>",
  api_key="llx-...",
)

nodes = index.as_retriever().retrieve(query)
response = index.as_query_engine().query(query)`;

      return {
        content: [
          {
            type: "text",
            text: codeSnippet,
          },
        ],
      };
    },
  },
};
