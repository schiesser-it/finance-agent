import { ToolConfig } from "./types";

export const pdfReaderTools: Record<string, ToolConfig> = {
  pdf_reader: {
    schema: {
      title: "PDF Reader",
      description: `Returns code snippet for PDF reading using LlamaCloud. Use this code snippet in the notebook for read a pdf file.
If the user environment is missing the llama_cloud_services package, you need to install the llama_cloud_services package for the user.
`,
      inputSchema: {},
    },
    handler: async () => {
      const codeSnippet = `from llama_cloud_services import LlamaParse
# Init a llamaparse client
parser = LlamaParse(api_key="llx-...")

# Update to your pdf file
result = parser.parse("./my_file.pdf") 

# get the llama-index markdown documents
markdown_documents = result.get_markdown_documents(split_by_page=True)

# You can then print the content from the markdown documents
for doc in markdown_documents:
    print(doc.text, "\n\n===========\n\n")
`;

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
