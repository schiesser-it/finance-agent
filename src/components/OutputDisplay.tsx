import React from 'react';
import { Box, Text } from 'ink';

interface OutputDisplayProps {
  output: string[];
}

const OutputDisplay: React.FC<OutputDisplayProps> = ({ output }) => {
  if (output.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {output.map((line, index) => (
        <Text key={index} color={line.startsWith('>') ? 'green' : 'white'}>
          {line}
        </Text>
      ))}
    </Box>
  );
};

export default OutputDisplay;