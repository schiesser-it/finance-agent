export type CommandSpec = {
  name: string;
  description: string;
  takesArgument?: boolean;
};

export const COMMANDS: CommandSpec[] = [
  { name: "/help", description: "Show available commands" },
  { name: "/examples", description: "Show example prompts" },
  { name: "/update", description: "Update the Python environment" },
  {
    name: "/reset",
    description: "Delete the current artifact (notebook or dashboard) to start fresh",
  },
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
  {
    name: "/mode",
    description: "Show or set generation mode (notebook|dashboard)",
    takesArgument: true,
  },
  { name: "/open", description: "Open the current artifact (notebook or dashboard) based on mode" },
  { name: "/quit", description: "Exit the application" },
];
