# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinAgent is an interactive financial analysis CLI tool that generates Jupyter Notebooks using Claude Code. It's built with React (using Ink for terminal UI) and TypeScript, featuring its own embedded Jupyter Notebook server for financial analysis workflows.

## Development Commands

### Build and Run

- `npm run build` - Build production bundle using tsup
- `npm run dev` - Run in development mode using tsx
- `npm start` - Run the production build
- `npm install` - Install dependencies

### Code Quality

- `npm run lint` - Run ESLint with max 0 warnings
- `npm run format` - Format code using Prettier
- `npm run format:check` - Check formatting without making changes

### Testing

- `npm test` - Run tests in watch mode using Vitest
- `npm run test:run` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

**Test Framework**: Vitest with React Testing Library and jsdom
**Test Location**: Tests are located in `src/hooks/__tests__/` directory
**Coverage**: Comprehensive tests for all custom hooks:

- `useCommands` - Command execution, output handling, and lifecycle management
- `useInput` - Input state, history navigation, command completion, and file references
- `useFileSearch` - File system searching, filtering, and navigation
- `useExamples` - Example prompt management and selection

### Versioning

- `npm run changeset` - Create a new changeset
- `npm run version` - Version packages and update package-lock.json

## Architecture

### Core Components

- **App.tsx** - Main application component with keyboard input handling and UI orchestration
- **VenvSetupGate** - Manages Python virtual environment setup for Jupyter
- **UpdateCheckGate** - Handles version update checks

### Key Services

- **claudeService.ts** - Interfaces with @anthropic-ai/claude-code SDK for AI interactions
- **jupyterService.ts** - Manages Jupyter Notebook server lifecycle (start/stop/status)
- **commands.ts** - Defines available slash commands (/help, /examples, etc.)
- **config.ts** - Handles configuration management and API key storage
- **prompts.ts** - Contains system prompts and prompt building logic

### UI Components

- **InputPrompt** - Command line input interface
- **OutputDisplay** - Displays command outputs and responses
- **FileSearch** - File reference system using @ prefix
- **CommandCompletions** - Auto-completion for slash commands
- **ExamplesList** - Shows predefined example prompts

### Hooks

- **useCommands** - Manages command execution and output handling
- **useInput** - Handles input state, history, and completions
- **useFileSearch** - File reference functionality
- **useExamples** - Example prompts management

## Key Features

### Jupyter Integration

- Automatically starts/stops Jupyter server in background
- Creates `analysis.ipynb` notebooks in current directory
- Uses Python virtual environment in `$HOME/.finance-agent`
- Server runs on port 8888 by default (configurable via JUPYTER_PORT)

### Financial Analysis Focus

- System prompt positions Claude as "senior equity research analyst at Goldman Sachs"
- Auto-includes guidance for visual graphs using plotly
- Includes yfinance-specific guidance (auto_adjust=True default)

### Command System

Available slash commands:

- `/help` - Show available commands
- `/examples` - Show example prompts
- `/update` - Update Jupyter server
- `/reset` - Delete notebook to start fresh
- `/fix` - Analyze last error and propose fix
- `/dashboard` - Generate dashboard file
- `/start-dashboard` / `/stop-dashboard` - Dashboard server management
- `/login` - Enter Anthropic API key
- `/model` - Show/set active model
- `/thinking` - Set thinking mode (none/normal/hard/harder)

### File References

Users can reference files using `@filename` syntax during input, with auto-completion.

## Configuration

- Configuration stored in user's home directory under `.finance-agent`
- API keys and settings managed via config service
- Virtual environment automatically managed for Python dependencies
- Jupyter server metadata tracked in `jupyter.meta.json`

## Build Configuration

- **TypeScript**: ES2022 target, ESNext modules, React JSX
- **tsup**: Bundles to ESM format, minified, targeting Node.js
- **Target**: Node.js 20+ (reads from .nvmrc if available)
