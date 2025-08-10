#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import App from "./App.js";
import { ensureAnthropicApiKeyEnvFromConfig } from "./services/config.js";

ensureAnthropicApiKeyEnvFromConfig();

render(<App />, { exitOnCtrlC: false });
