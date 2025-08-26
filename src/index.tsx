#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import App from "./App.js";
import CleanupGate from "./components/CleanupGate.js";
import UpdateCheckGate from "./components/UpdateCheckGate.js";
import { ensureAnthropicApiKeyEnvFromConfig } from "./services/config.js";

ensureAnthropicApiKeyEnvFromConfig();

render(
  <UpdateCheckGate>
    <CleanupGate>
      <App />
    </CleanupGate>
  </UpdateCheckGate>,
  { exitOnCtrlC: false },
);
