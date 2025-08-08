#!/usr/bin/env node
import { jsx as _jsx } from "react/jsx-runtime";
import { render } from 'ink';
import App from './App.js';
render(_jsx(App, {}), { exitOnCtrlC: false });
