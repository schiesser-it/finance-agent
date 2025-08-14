#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import App from "./App.js";
import NotebookCleanupGate from "./components/NotebookCleanupGate.js";
import UpdateCheckGate from "./components/UpdateCheckGate.js";
import { ensureAnthropicApiKeyEnvFromConfig } from "./services/config.js";

ensureAnthropicApiKeyEnvFromConfig();

render(
  <UpdateCheckGate>
    <NotebookCleanupGate>
      <App />
    </NotebookCleanupGate>
  </UpdateCheckGate>,
  { exitOnCtrlC: false },
);
