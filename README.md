# FinAgent

Interactive financial analyst generating Jupyter Notebooks using Claude Code. Brings its own Jupyter Notebook server for convenience.

## Prerequisites

- Node.js 22+ (get it from https://nodejs.org/en/download)
- Python 3.12+
- pnpm (for development)
- Anthropic API key (get it from https://console.anthropic.com/)

## Install

- `pnpm install` (no dev deps required)

## Run

- `pnpm dev` for development
- `pnpm build && pnpm start` for production

## Usage

- Type a full-sentence prompt and press Enter (or type `/examples` to see examples)
- A `analysis.ipynb` file will be created in the current directory and opened in the Jupyter Notebook server provided by the tool.
- Type a follow-up prompt and press `Enter` to update the `analysis.ipynb` file
- Use `/restart` to delete the `analysis.ipynb` file and start over
- While typing, reference files with `@` prefix. Example: type `@a` to list matches; Up/Down to highlight; Tab to insert the selected `@file` into the prompt.
- Quit with `Ctrl+C`.

## Jupyter server

The Jupyter server is installed in a virtual environment and runs in the background on startup and shutdowns automatically on exit.
The virtual environment is located in the `$HOME/.finance-agent` directory.

To update the Jupyter server, use the `/update` command.

## License and contributions

- This project is licensed under **AGPL-3.0-only** (see `LICENSE`).
- By contributing, you must agree to the project's **Contributor License Agreement (CLA)** (`CLA.md`). The CLA grants the maintainer (Marcus Schiesser) the right to use and relicense your contribution, including under commercial terms, while the open-source distribution remains under AGPL.
- Pull requests must check the CLA box in the PR template; a CI check will block merges if not agreed.
