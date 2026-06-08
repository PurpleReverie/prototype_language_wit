# Wit — Overview Agent Memory

Persistent codebase knowledge maintained across task boundaries (per RULES.md rule 4).
This file is the overview agent's working memory; implementer/reviewer agents do not read it directly — they receive task briefings derived from it.

---

## Project goal

Wit is a prose-first markup language for writers and the systems that consume their writing. v1.0 ships: (1) a zero-dependency TypeScript parser library that emits a typed, source-located AST; (2) a small runtime (resolver + expander) that binds references and inlines definitions; (3) a reference HTML renderer; (4) a VS Code extension with minimal LSP; (5) a `.wit` fixture corpus that doubles as the executable spec; (6) docs (spec PDF, narrative examples, intro guide). The spec PDF (`wit-spec.pdf`) is the canonical reference; `examples/` pressure-tests the syntax.

---

## Architecture — 5-stage pipeline (PLAN section C)

```
source string
   -> Lexer       tokens with source locations
   -> Parser      raw AST (invocations unresolved)
   -> Resolver    bound AST (every @x linked to its #x)
   -> Expander    expanded AST (definitions inlined; if/each evaluated)
   -> Renderer    output (HTML / JSON / typeset / game tree)
```

Each stage is independently testable and replaceable. Every AST node carries `{ file, line, col, length }`. Tools that only need structure (LSP, formatter) stop after Parser or Resolver.

---

## Planned module layout (PLAN section L)

```
packages/
  parser/         lexer.ts, parser.ts, ast.ts, errors.ts, index.ts
  runtime/        resolver.ts, expander.ts, lh.ts, index.ts
  render-html/    reference renderer
  vscode/         extension + LSP (server/, client/, syntaxes/)
  cli/            wit build / wit parse / wit check
tests/
  fixtures/       00-lexical/ ... 17-combinations/  (.wit + .json snapshot pairs)
  integration/    whole-document tests
  errors/         .wit + .err.json pairs
  runner/         workspace member; snapshot.ts, walk.ts (planned)
.github/workflows/ci.yml
```

Note: PLAN.md section L originally called for `tests/runner/vitest.config.ts`. M0 overrode this — vitest config now lives at repo root. See "Scaffold notes" below.

---

## Conventions

- **Language:** TypeScript, `strict: true`, ESM only (no CJS).
- **Package manager:** pnpm@9.15.9 workspaces. Node 20 in CI.
- **Test runner:** vitest, snapshot-based. `pnpm test` / `pnpm test --update`.
- **CI:** GitHub Actions on push/PR: `pnpm install --frozen-lockfile` -> `pnpm typecheck` -> `pnpm test` -> `pnpm build`.
- **Versioning:** Changesets; pre-1.0 = 0.x.
- **File size:** under 350 lines (RULES rule 1). Approaching the limit is a signal to extract.
- **Function size:** 20 lines (RULES rule 2). Use local helpers named for intent.
- **Parser package:** zero `dependencies` field per DS-18 (lint-checked).
- **Determinism:** sorted key iteration; same input -> same AST (DS-19).
- **Errors:** `WitError { code, message, loc }` with stable codes (`E_UNCLOSED_NODE`, etc).
- **AST:** serializable JSON, no cycles by structure (resolver uses handles, not pointers).

---

## File index (existing repo state)

Root:
- `/README.md` — project blurb + table of example files.
- `/PLAN.md` — comprehensive plan: vision, architecture, milestones M0–M7, user stories, dev stories DS-1..DS-21, TDD stories, open questions I.1–I.17, file layout, ops.
- `/RULES.md` — programming rules: file <350 lines, function <20 lines, per-task two-agent loop, overview agent (this), tester agent gating merge.
- `/wit-spec.pdf` — canonical language spec.
- `/cspell.json` — spellcheck config.
- `/package.json` — root workspace; pnpm@9.15.9; devDeps `@types/node ^20.14.0`, `typescript ^5.5.4`, `vitest ^2.0.5`; scripts `test`/`typecheck`/`build`.
- `/pnpm-workspace.yaml` — workspace members: `packages/*`, `tests/runner`.
- `/pnpm-lock.yaml` — frozen lockfile (CI uses `--frozen-lockfile`).
- `/tsconfig.json` — root solution tsconfig; `strict`, ES2022, ESNext modules, Bundler resolution, `noEmit: true`, references `./packages/parser`.
- `/vitest.config.ts` — root vitest config; `include` covers `tests/{fixtures,integration,errors}/**/*.test.ts` and `packages/**/*.test.ts`.
- `/.gitignore` — `node_modules`, `dist`, `.DS_Store`, `*.tsbuildinfo`.

Examples (narrative one-feature-per-file):
- `/examples/01-prose.wit` ... `/examples/17-scripting.wit`, incl. dirs `15-references/`, `16-additive-partials/`.

Packages:
- `/packages/parser/package.json` — `@wit/parser`, private, ESM, exports `./dist/index.js`. **No `dependencies` field** (DS-18).
- `/packages/parser/tsconfig.json` — extends root; `composite: true`, `noEmit: false`, `rootDir: ./src`, `outDir: ./dist`, declarations + maps on.
- `/packages/parser/src/index.ts` — `export * from './ast.js';` (note `.js` extension for ESM resolution of `.ts` source).
- `/packages/parser/src/ast.ts` — placeholder `export {};` to be populated in M1.

Tests:
- `/tests/runner/package.json` — `@wit/test-runner`, exists only to satisfy pnpm workspaces; no source yet.
- `/tests/fixtures/README.md` — fixture-authoring conventions (see "Fixture authoring conventions" below).
- `/tests/fixtures/00-lexical/` — 13 lexical-layer fixtures: `empty.wit`, `minimal-non-empty.wit`, `single-paragraph.wit`, `multi-paragraph.wit`, `leading-whitespace.wit`, `tabs-vs-spaces.wit`, `whitespace-only-line.wit`, `trailing-newline.wit`, `no-trailing-newline.wit`, `multiple-trailing-newlines.wit`, `windows-newlines.wit`, `mac-newlines.wit`, `mixed-newlines.wit`. Plus `_notes.md` (the canonical template — 5 open questions logged, each H2 cites a PLAN.md `I.x` or flags a new `I.review` item). No `.test.ts` / snapshot files yet — those will arrive with the snapshot runner.

CI/tooling:
- `/.github/workflows/ci.yml` — `ubuntu-latest`, `pnpm/action-setup@v4`, Node 20 with pnpm cache; runs install/typecheck/test/build.
- `/.claude/settings.local.json` — Claude Code local settings.
- `/.agent-state/overview.md` — THIS FILE.

---

## Open design questions (PLAN section I)

To be resolved during M1 (fixture-writing forces ambiguities to surface):

1. Are comments AST nodes or fully elided?
2. Single newline within a paragraph — collapse to space, or preserve as soft break?
3. Where can `@name.field` access appear — only in statements/params, or also in body prose?
4. Parameter values — always unquoted, or quoted for special chars?
5. Numeric literals in records — distinguished type or strings?
6. Bare reference vs prose: where does `@weil` end? Whitespace? Punctuation?
7. `!!` greedy-parse risk in body prose — context-only, always-reserved (`\!!` escape), or position-restricted?
8. Forward references — `@x` before `#x`? Lean yes (hoisted).
9. Definition scope — file-local or merged across references? Lean global within ref graph.
10. `lh.set(...)` immutability — mutate AST or layered overlay?
11. Mixing parens and pipes on same node — error or merge?
12. Multi-word flags via parens: `@badge(full width!)` — whole flag or single word?
13. `@scriptCall(fn)` — builtin or generic? Calling convention?
14. Source locations across additive partials — file-tagged child nodes?
15. Indentation in records/collections — required for multi-line or cosmetic?
16. Short-close `!!`: inline-only, or block-allowed?
17. Combining `!!` close with parens (`@name(p,q) body !!`) — allowed?

---

## Fixture authoring conventions

Codified in `/tests/fixtures/README.md`. Summary:

- **Layout:** `tests/fixtures/<NN>-<category>/<scenario>.wit` + a single `_notes.md` per category. `NN` matches the M1.NN milestone (`00`–`17`).
- **Filenames:** kebab-case, scenario-descriptive (`minimal-non-empty.wit`, not `one-word.wit`). One fixture = one purpose; if "and" appears in the name, split it. Combinations belong in `17-combinations/`.
- **`_notes.md`:** one per category. Every H2 must cite a PLAN.md `I.x` open question (e.g. `## Paragraph boundaries (PLAN.md I.2)`). New questions not yet in PLAN are flagged `(no PLAN.md entry — new I.review item)` and surfaced at the next review. `tests/fixtures/00-lexical/_notes.md` is the canonical template — point new contributors at it.
- **Byte-sensitive fixtures:** author via `printf` and verify with `od -c`; record the `printf` invocation in `_notes.md`. Do NOT edit these files in editors that may normalize line endings. `wc -l` undercounts files without a trailing LF — check `od -c` before "fixing" off-by-one line counts.
- **Narration comments inside `.wit`:** allowed in `00-lexical`, `01-prose`, `02-emphasis` (the comment marker is barely under test). From `03-comments/` onward, narration must move to `_notes.md` — comments that remain in the fixture are exactly what is being tested.
- **Workflow:** add fixture -> update `_notes.md` -> `pnpm test` (snapshots missing on first run; review diff then `pnpm test --update`) -> commit fixture + notes + snapshot together.

---

## Surfaced design questions (open)

Accumulated from per-category `_notes.md` files. To be resolved at M1.review and folded into PLAN.md / spec v0.2.

**From `00-lexical/_notes.md` (M1.00):**
- Whitespace-only line (`   \t  \n`): does it count as a blank line / paragraph separator, or as content? Changes paragraph count in `whitespace-only-line.wit`.
- Newline normalization: does the parser normalize CR/CRLF/LF -> LF pre-lex, or split paragraphs first and normalize after? Order of operations changes results in `mixed-newlines.wit`.
- Comment line between two prose lines: does it *join* them into one paragraph or *separate* them into two? (Related to I.1 — AST nodes vs elided.)
- `empty.wit` (0 bytes): empty document, error, or single empty paragraph?
- Trailing-LF semantics: `\n\n\n` ending — zero, one, or three trailing empty paragraphs? Spec silent.
- (Non-blocking, known M1.review item) Stale spec PDF: `wit-spec.pdf` pp. 3–4 shows old `\- ... -\` comment syntax; examples and fixtures use `~ ...`. Examples treated as source of truth.

---

## Tasks completed

- **Task 1 — M0 scaffold** (merge `8eec37e`): TS monorepo scaffold landed; `pnpm install/typecheck/test/build` all green. pnpm workspace with `packages/parser` (empty AST placeholder) and `tests/runner` workspace stub; root tsconfig solution file with project reference to parser; root vitest config; GitHub Actions CI on Node 20. Ready to receive fixture and parser code.
- **Task 2 — M1.00 lexical fixtures** (merge `38d6e7b`): 13 `.wit` fixtures under `tests/fixtures/00-lexical/` covering empty/minimal inputs, paragraph boundaries, whitespace/tabs, and CR/LF/CRLF newline conventions. Byte-sensitive newline fixtures authored via `printf` and verified with `od -c`. `_notes.md` logs 5 open design questions (see above), each H2 citing PLAN.md `I.x` or flagging an `I.review` item. Established `tests/fixtures/README.md` codifying fixture-authoring conventions (see above). No snapshot runner yet — fixtures sit ready for when it lands.

---

## Scaffold notes for future implementers

- **Vitest config lives at repo root** (`/vitest.config.ts`), NOT under `tests/runner/`. PLAN.md section L's intended location was overridden because vitest auto-discovery from `pnpm test` at the root needed the config visible there. The `include` array in this file is the source of truth for test discovery; new test directories must be added there. Do not "fix" this back to `tests/runner/`.
- **`tests/runner/package.json` exists only to satisfy pnpm workspaces.** No source code yet. When snapshot helpers (`snapshot.ts`, `walk.ts`) land, they can go here, but tests themselves live under `tests/fixtures|integration|errors/`.
- **`packages/parser` has zero `dependencies`** — DS-18 mandate. Adding any runtime dep is a deliberate, reviewer-flagged decision. devDependencies are fine (and currently absent; the package inherits tsc/vitest from root).
- **`dist/` is gitignored.** `tsc --build` emits there via the parser's `composite: true` tsconfig. Root tsconfig has `noEmit: true`; only project-referenced packages emit.
- **ESM resolution quirk:** parser source uses `.js` extensions in imports (e.g. `export * from './ast.js'`) even though the source files are `.ts`. This is the standard NodeNext/Bundler ESM pattern — preserve it in new files.
- **Versions pinned:** pnpm@9.15.9 via `packageManager`; Node 20 in CI; TypeScript ^5.5.4; vitest ^2.0.5. Use the same in any new tooling.
- **`pnpm test` uses `--passWithNoTests`** — currently green with zero tests. Adding a single failing test will surface immediately in CI.
- **Project references:** root `tsconfig.json` references `./packages/parser`. New packages must (a) get their own `composite: true` tsconfig and (b) be added to root's `references` array, or `pnpm typecheck` will skip them.

---

## Notes for next briefing cycle

- **M1.01 — prose fixtures for `tests/fixtures/01-prose/`** is the next dispatch. PLAN section E.1 "Prose", user stories W1.1–W1.5. Implementer should be briefed to:
  - Read `/tests/fixtures/README.md` first (the conventions) and `/tests/fixtures/00-lexical/_notes.md` as the format template for `_notes.md`.
  - Read `/examples/01-prose.wit` and `wit-spec.pdf` prose section for grounding.
  - **Narration comments (`~ ...`) inside fixtures are still permitted** at this category (00–02 window per the README).
  - Scenarios to cover (one fixture per purpose, kebab-case names):
    - pure single-paragraph prose (positive baseline)
    - multi-paragraph prose (separator semantics in a richer-than-00 setting)
    - lines starting with reserved/markdown-ish characters: `>`, `*`, `-`, `1.` — confirm Wit treats them as plain prose, not block syntax
    - punctuation, URLs (e.g. `https://...`), numeric content embedded in prose — confirm no accidental tokenization
    - any other W1.1–W1.5 angle not covered above
  - Create `tests/fixtures/01-prose/_notes.md` with H2s citing PLAN.md `I.x` (especially I.2 soft-line-break, I.6 bare-reference termination — even though `@` won't appear yet, prose-edge cases inform the boundary). New questions flagged `(no PLAN.md entry — new I.review item)`.
  - Avoid `@`-references, `#`-defs, `!!` close, emphasis, or any non-prose syntax — those belong to later categories.
  - Do NOT add snapshot `.json` files yet — the snapshot runner has not landed. Fixtures + `_notes.md` only.
- Keep this file under 250 lines. Prune resolved design questions into a separate "Decisions" section once they land.
