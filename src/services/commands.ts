export type CommandSpec = {
  name: string;
  description: string;
  takesArgument?: boolean;
};

export const COMMANDS: CommandSpec[] = [
  { name: "/help", description: "Show available commands" },
  { name: "/examples", description: "Show example prompts" },
  { name: "/restart", description: "Restart Jupyter Notebook server" },
  { name: "/update", description: "Update the Jupyter Notebook server" },
  { name: "/reset", description: "Delete the notebook to start fresh" },
  { name: "/fix", description: "Analyze last error in notebook and propose a fix" },
  { name: "/login", description: "Enter your Anthropic API key" },
  {
    name: "/model",
    description: "Show or set the active model",
    takesArgument: true,
  },
  {
    name: "/thinking",
    description: "Show or set thinking mode (none|normal|hard|harder)",
    takesArgument: true,
  },
  { name: "/quit", description: "Exit the application" },
];
