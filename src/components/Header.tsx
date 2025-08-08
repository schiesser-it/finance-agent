import { Box, Text } from "ink";
import React from "react";

import { version } from "../../package.json";

const Header: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">
        Finance Agent v{version} &copy; 2025 Schiesser IT, LLC - Type your prompt, use /help, or
        Ctrl+C to quit
      </Text>
      <Text color="gray">
        {"Use @ to reference files (e.g., @readme will show files containing 'readme')"}
      </Text>
    </Box>
  );
};

export default Header;
