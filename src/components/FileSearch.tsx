import { Box, Text } from "ink";
import React from "react";

import { FileMatch } from "../types.js";

interface FileSearchProps {
  fileMatches: FileMatch[];
  selectedIndex: number;
  isVisible: boolean;
}

const FileSearch: React.FC<FileSearchProps> = ({ fileMatches, selectedIndex, isVisible }) => {
  if (!isVisible || fileMatches.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Text color="yellow">Files matching your query:</Text>
      {fileMatches.map((file, index) => (
        <Text
          key={index}
          color={index === selectedIndex ? "black" : "white"}
          backgroundColor={index === selectedIndex ? "white" : undefined}
        >
          {file.path}
        </Text>
      ))}
      <Text color="gray" dimColor>
        Use ↑↓ to navigate, Enter/Tab to select, Esc to cancel
      </Text>
    </Box>
  );
};

export default FileSearch;
