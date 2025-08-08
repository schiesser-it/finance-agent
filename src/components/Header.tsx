import { Box, Text } from "ink";
import React from "react";

const Header: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">Interactive CLI - Type your prompt, use /commands, or Ctrl+C to quit</Text>
      <Text color="gray">
        {"Use @ to reference files (e.g., @readme will show files containing 'readme')"}
      </Text>
    </Box>
  );
};

export default Header;
