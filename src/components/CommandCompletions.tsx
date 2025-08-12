import { Box, Text } from "ink";
import React, { useMemo } from "react";

import { COMMANDS } from "../services/commands.js";

interface CommandCompletionsProps {
  commandMatches: string[];
  selectedIndex: number;
  isVisible: boolean;
}

const CommandCompletions: React.FC<CommandCompletionsProps> = ({
  commandMatches,
  selectedIndex,
  isVisible,
}) => {
  const descriptionByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of COMMANDS) {
      map.set(c.name, c.description);
    }
    return map;
  }, []);

  if (!isVisible || commandMatches.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Text color="yellow">Commands:</Text>
      {commandMatches.map((cmd, index) => (
        <Text
          key={`${cmd}-${index}`}
          color={index === selectedIndex ? "black" : "white"}
          backgroundColor={index === selectedIndex ? "white" : undefined}
        >
          {cmd}
          {descriptionByName.get(cmd) ? ` — ${descriptionByName.get(cmd)}` : ""}
        </Text>
      ))}
      <Text color="gray" dimColor>
        Use ↑↓ to navigate, Enter/Tab to select, Esc to cancel
      </Text>
    </Box>
  );
};

export default CommandCompletions;
