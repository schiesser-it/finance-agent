#!/usr/bin/env node

import { render } from "ink";
import React from "react";

import App from "./App.js";

render(<App />, { exitOnCtrlC: false });
