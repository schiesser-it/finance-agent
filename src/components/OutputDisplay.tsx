import { Box, Text } from "ink";
import React from "react";

interface OutputDisplayProps {
  output: string[];
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ output }) => {
  if (output.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {output.map((line, index) => (
        <Text key={index} color={line.startsWith(">") ? "green" : "white"}>
          {line}
        </Text>
      ))}
    </Box>
  );
};

export default OutputDisplay;
