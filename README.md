Finance Analyst CLI (Ink)

Quick interactive CLI using React + Ink.

Prerequisites
- Node.js 18+

Install
- From repo root: `npm install` (no dev deps required)
- Make binary executable: `chmod +x bin/fa.js`

Run
- `npm start` or `node bin/fa.js`
- Optionally link: `npm link` then run `fa`

Usage
- Type a full-sentence prompt and press Enter.
- Use `/status` to show current status.
- While typing, reference files with `@` prefix. Example: type `@a` to list matches; Up/Down to highlight; Tab to insert the selected `@file` into the prompt.
- Quit with `Ctrl+C`.

Notes
- Execution currently just echoes the prompt.
- Suggestions list shows up to 8 matches, excluding dotfiles.

