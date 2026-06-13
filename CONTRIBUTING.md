# Contributing to Wit

Thanks for your interest in Wit. This is a small project maintained
mostly in spare time — I aim to triage issues and PRs within a week,
though life sometimes intervenes.

## Setup

```
git clone https://github.com/PurpleReverie/prototype_language_wit
cd prototype_language_wit
pnpm install
pnpm build
pnpm test
```

Wit requires Node.js >= 20 and pnpm >= 9.

## Scripts

- `pnpm test` — run the full vitest suite (727 tests at v0.1.0).
- `pnpm test:tour` — exercise the full feature tour via the CLI.
- `pnpm test:parse` — parse the feature tour and emit the AST.
- `pnpm typecheck` — TypeScript project-references build, no emit checks.
- `pnpm build` — compile all packages.
- `pnpm vscode:install` — package and install the VS Code extension locally.

## Engineering constraints

The cadence is documented in [`RULES.md`](./RULES.md). The short version:

- **350-line files, 20-line functions.** Hard ceilings. Split before you exceed.
- **Test-first.** Add a fixture or unit test before the change that
  satisfies it.
- **Fixtures are the executable spec.** Anything user-visible lives in
  `tests/fixtures/<category>/` with a `.wit` source and a matching
  snapshot.

## Adding a fixture

1. Drop a `.wit` file under `tests/fixtures/<category>/`.
2. Run `WIT_SNAPSHOT_UPDATE=1 pnpm test` to generate the snapshot.
3. Eyeball the snapshot. If it looks right, commit both files together.
4. Re-run `pnpm test` without the env var to confirm the snapshot is stable.

## Pull requests

- One focused change per PR.
- Include a test for new behavior (a fixture is usually the right shape).
- Reference any related issue.
- Keep the diff small enough that I can review it in a sitting.

## AI-assisted development

Wit was developed collaboratively with Claude (Anthropic's AI assistant).
The engineering process — milestone gating, file/function size budgets,
test-first cadence — is documented in [`RULES.md`](./RULES.md) so
contributors can read it and understand the rhythm. Human review is
required on every change.
