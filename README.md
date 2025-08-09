Finance Agent CLI

Interactive financial analyst generating Jupyter Notebooks using Claude Code.

## Prerequisites

- Node.js 20+
- Jupyter Notebook
- pnpm
- Claude API key (https://console.anthropic.com/)

## Install

- `pnpm install` (no dev deps required)

## Run

- `pnpm dev` for development
- `pnpm build && pnpm start` for production

## Usage

- Type a full-sentence prompt and press Enter (see examples below)
- A `analysis.ipynb` file will be created in the current directory - open it with Jupyter Notebook
- Type a follow-up prompt and press Enter to update the `analysis.ipynb` file
- Use `/restart` to delete the `analysis.ipynb` file and start over
- While typing, reference files with `@` prefix. Example: type `@a` to list matches; Up/Down to highlight; Tab to insert the selected `@file` into the prompt.
- Quit with `Ctrl+C`.

## License and contributions

- This project is licensed under **AGPL-3.0-only** (see `LICENSE`).
- By contributing, you must agree to the project's **Contributor License Agreement (CLA)** (`CLA.md`). The CLA grants the maintainer (Marcus Schiesser) the right to use and relicense your contribution, including under commercial terms, while the open-source distribution remains under AGPL.
- Pull requests must check the CLA box in the PR template; a CI check will block merges if not agreed.

## Examples

### 1. Get the latest performance data for S&P500 and DAX

1. Start by typing this prompt:
   Get the latest performance data for S&P500 and DAX and compare their performance over the last 10 years.
2. Open the generated `analysis.ipnb` file in Jupyter Notebook after the agent is finished.

### 2. Analyze an existing balance sheet file

1. Start by typing this prompt:
   Analyze @data/balance_sheet.csv for liquidity positions and working capital.
2. Open the generated `analysis.ipnb` file after the agent is finished
3. Add this follow-up prompt:
   Add a debt ratio analysis.
4. Reload the `analysis.ipnb` file in Jupyter Notebook to see the updated analysis
