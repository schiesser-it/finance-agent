import { Box, Text } from "ink";
import React from "react";

interface InputPromptProps {
  input: string;
  example?: string;
}

const InputPrompt: React.FC<InputPromptProps> = ({ input, example }) => {
  return (
    <Box>
      <Text color="blue">{"> "}</Text>
      {example ? <Text color="gray">{example}</Text> : <Text>{input}</Text>}
      <Text>█</Text>
    </Box>
  );
};

export default InputPrompt;
