import { Box, Text, useInput } from "ink";
import React from "react";

interface ConfirmPromptProps {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmPrompt: React.FC<ConfirmPromptProps> = ({ visible, message, onConfirm, onCancel }) => {
  useInput((input, key) => {
    if (!visible) return;
    if (key.ctrl && input === "c") {
      onCancel();
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      // default to No
      onCancel();
      return;
    }
    if (!key.ctrl && !key.meta) {
      const lowered = input.toLowerCase();
      if (lowered === "y") {
        onConfirm();
        return;
      }
      if (lowered === "n") {
        onCancel();
        return;
      }
    }
  });

  if (!visible) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{message}</Text>
      <Text color="gray">Press Y to confirm, N or Enter to cancel.</Text>
    </Box>
  );
};

export default ConfirmPrompt;
