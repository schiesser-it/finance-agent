Contributing Guide

Thank you for considering a contribution! Please follow these guidelines.

## Development

- Use Node.js 20+.
- Install: `npm install`
- Run: `npm run dev`

## Code style

- TypeScript, ESLint and Prettier are configured. Run `npm run lint` and `npm run format:check` before opening a PR.

## Pull Requests

- Create focused PRs with a clear description.
- Ensure the build passes.
- A PR template will ask you to confirm the Contributor License Agreement (CLA). You must agree for the PR to be merged.

### Changesets

- Every pull request that changes user-facing behavior or dependencies must include a changeset.
- Create one by running `npm run changeset` and follow the prompts. Commit the generated file under `.changeset/`.

## Contributor License Agreement (CLA)

- The project is AGPL-3.0-only for open-source distribution.
- By contributing, you agree to the CLA in `CLA.md`, granting the maintainer the right to relicense your contributions, including commercially.
- For entity contributions, an authorized representative must agree in the PR.

## Reporting issues

- Provide steps to reproduce and environment details.
