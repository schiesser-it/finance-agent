import { Box, Text } from "ink";
import React from "react";

interface InputPromptProps {
  input: string;
  isExecuting?: boolean;
  example?: string;
}

const InputPrompt: React.FC<InputPromptProps> = ({ input, isExecuting = false, example }) => {
  return (
    <Box>
      <Text color="blue">{"> "}</Text>
      {example ? <Text color="gray">{example}</Text> : <Text>{input}</Text>}
      {isExecuting ? (
        <Text color="yellow">[Agent Running... Press Ctrl+C to cancel]</Text>
      ) : (
        <Text>█</Text>
      )}
    </Box>
  );
};

export default InputPrompt;
