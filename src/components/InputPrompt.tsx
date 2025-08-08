import React from "react";
import { Box, Text } from "ink";

interface InputPromptProps {
  input: string;
  isExecuting?: boolean;
}

const InputPrompt: React.FC<InputPromptProps> = ({ input, isExecuting = false }) => {
  return (
    <Box>
      <Text color="blue">{"> "}</Text>
      <Text>{input}</Text>
      {isExecuting ? (
        <Text color="yellow">[Agent Running... Press Ctrl+C to cancel]</Text>
      ) : (
        <Text>█</Text>
      )}
    </Box>
  );
};

export default InputPrompt;
