import { Box, Text } from "ink";
import React from "react";

interface ExamplesListProps {
  examples: string[];
  selectedIndex: number;
}

const ExamplesList: React.FC<ExamplesListProps> = ({ examples, selectedIndex }) => {
  if (examples.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Text color="yellow">Pick an example:</Text>
      {examples.map((ex, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box key={idx}>
            <Text color="gray">{`${idx + 1}. `}</Text>
            <Text
              color={isSelected ? "black" : "white"}
              backgroundColor={isSelected ? "white" : undefined}
            >
              {ex}
            </Text>
          </Box>
        );
      })}
      <Text color="gray" dimColor>
        Use ↑↓ to navigate, Enter/Tab to select, Esc to cancel
      </Text>
    </Box>
  );
};

export default ExamplesList;
