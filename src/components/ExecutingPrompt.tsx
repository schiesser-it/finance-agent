import { Box, Text } from "ink";
import React, { useEffect, useMemo, useState } from "react";

const ExecutingPrompt: React.FC = () => {
  const spinnerFrames = useMemo(() => ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], []);

  const funMessages = useMemo(
    () => [
      "Crunching numbers and brewing insights…",
      "Sharpening pencils and plotting charts…",
      "Checking the yield on your patience…",
      "Backtesting optimism…",
      "Compiling strategies and good vibes…",
      "Running a Monte Carlo on your luck…",
      "Balancing the books and the cosmos…",
      "Fetching alpha… please hold the beta…",
    ],
    [],
  );

  const [frameIndex, setFrameIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const spinInterval = setInterval(() => {
      setFrameIndex((idx) => (idx + 1) % spinnerFrames.length);
    }, 80);

    const timerInterval = setInterval(() => {
      setElapsedMs((ms) => ms + 1000);
    }, 1000);

    const messageInterval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % funMessages.length);
    }, 6000);

    return () => {
      clearInterval(spinInterval);
      clearInterval(timerInterval);
      clearInterval(messageInterval);
    };
  }, [spinnerFrames.length, funMessages.length]);

  const minutes = Math.floor(elapsedMs / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((elapsedMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");

  return (
    <Box flexDirection="column">
      <Text color="yellow">
        {spinnerFrames[frameIndex]} Executing… {minutes}:{seconds}
      </Text>
      <Text color="gray">{funMessages[messageIndex]} — Press Ctrl+C to cancel</Text>
    </Box>
  );
};
export default ExecutingPrompt;
