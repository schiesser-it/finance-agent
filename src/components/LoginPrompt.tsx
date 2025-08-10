import { Box, Text, useInput } from "ink";
import React, { useCallback, useEffect, useState } from "react";

import { openExternalUrl } from "../services/browser.js";

interface LoginPromptProps {
  visible: boolean;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
}

const LoginPrompt: React.FC<LoginPromptProps> = ({ visible, onSubmit, onCancel }) => {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void openExternalUrl("https://console.anthropic.com/settings/keys").catch(() => {
      // ignore browser open errors
    });
  }, [visible]);

  const handleSubmit = useCallback(() => {
    const trimmed = apiKeyInput.trim();
    if (trimmed.length === 0) return;
    if (!trimmed.startsWith("sk-ant")) {
      setErrorMessage("Invalid API key. It should start with 'sk-ant'.");
      return;
    }
    setErrorMessage(null);
    onSubmit(trimmed);
    setApiKeyInput("");
  }, [apiKeyInput, onSubmit]);

  useInput((input, key) => {
    if (!visible) return;

    if (key.ctrl && input === "c") {
      onCancel();
      return;
    }
    if (key.return) {
      handleSubmit();
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.backspace || key.delete) {
      setApiKeyInput((prev) => prev.slice(0, -1));
      setErrorMessage(null);
      return;
    }
    if (!key.ctrl && !key.meta) {
      setApiKeyInput((prev) => prev + input);
      if (errorMessage) setErrorMessage(null);
    }
  });

  if (!visible) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>
        To login, get your API key from{" "}
        <Text color="cyan">https://console.anthropic.com/settings/keys</Text>
      </Text>
      <Text>and paste it here, then press Enter to proceed.</Text>
      <Box>
        <Text color="blue">{"API Key: "}</Text>
        <Text>{apiKeyInput}</Text>
        <Text>█</Text>
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color="red">{errorMessage}</Text>
        </Box>
      )}
    </Box>
  );
};

export default LoginPrompt;
