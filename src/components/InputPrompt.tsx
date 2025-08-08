import React from 'react';
import { Box, Text } from 'ink';

interface InputPromptProps {
  input: string;
}

const InputPrompt: React.FC<InputPromptProps> = ({ input }) => {
  return (
    <Box>
      <Text color="blue">{'> '}</Text>
      <Text>{input}</Text>
      <Text>█</Text>
    </Box>
  );
};

export default InputPrompt;