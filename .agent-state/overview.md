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
- `/tests/fixtures/01-prose/` — 12 prose-layer fixtures: `single-paragraph.wit`, `multi-paragraph.wit`, `blank-line-splits.wit`, `soft-line-break.wit`, `long-single-line.wit`, `markdown-ish-leaders.wit`, `punctuation-heavy.wit`, `quoted-prose.wit`, `urls-in-prose.wit`, `numbers-and-arithmetic-shapes.wit`, `tilde-digit-mid-line.wit`, `tilde-slash-mid-line.wit`. Plus `_notes.md` probing I.2 (soft line break) and surfacing 4 new `I.review` items (see "Surfaced design questions" below).
- `/tests/fixtures/02-emphasis/` — 9 emphasis-layer fixtures: `basic-italic.wit`, `basic-bold.wit`, `combined-bold-italic.wit`, `apostrophe-after-italic.wit`, `arithmetic-shapes.wit`, `underscore-in-identifier.wit`, `empty-marks.wit`, `marks-at-paragraph-boundary.wit`, `mixed-prose-and-marks.wit`. Plus `_notes.md` surfacing 7 new `I.review` items (see "Surfaced design questions" below). Last category permitting in-fixture narration; `03-comments` onward narration is forbidden.
- `/tests/fixtures/03-comments/` — 8 comments-layer fixtures + `_notes.md`. **First category where in-fixture narration is FORBIDDEN** — all explanation lives in `_notes.md`. Probes PLAN.md I.1 directly. Surfaces 12 new `I.review` items (see "Surfaced design questions" below).

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

**From `01-prose/_notes.md` (M1.01):**
- Markdown-ish leaders (`> `, `* `, `- `, `1. `): preserved verbatim in the Text run, or stripped/normalized? Confirming Wit treats them as plain prose is established; the open question is the textual rendering — leading marker kept as bytes or elided/normalized? (new `I.review` item)
- Smart-quote substitution policy: do straight ASCII `'` and `"` get rewritten to typographic quotes (U+2018/2019/201C/201D) at lex/render time, or preserved verbatim? Stage matters (lexer, renderer, or never). (new `I.review` item)
- Number-shape tokenization inside Text runs (e.g. `3.14`, `1,000`, `5*6*7`): distinguished token type, or opaque substring of a Text run? Affects whether `3.14` ever surfaces in the AST as anything other than characters. (new `I.review` item)
- Email-shaped mid-word `@` (e.g. `user@example.com`): extends I.6 — a NodeUse `@name` should require a non-word boundary before `@` to open, otherwise emails fragment. Formalize the lookbehind rule. (new `I.review` item, extends PLAN.md I.6)
- Probed: I.2 soft line break — `soft-line-break.wit` and `long-single-line.wit` exercise the single-LF-inside-paragraph case; resolution still pending.
- **Cross-category fragility:** `01-prose/numbers-and-arithmetic-shapes.wit` is a snapshot landmine — its `5*6*7` content must re-validate once 02-emphasis lands `*bold*` tokenization, since the asterisk semantics conflict. Flag this fixture for explicit re-review at M1.02 merge.

**From `02-emphasis/_notes.md` (M1.02):**
- Empty mark `__` / `**` semantics: literal punctuation, parse error, or empty emphasis node? (new `I.review` item)
- Word-character class definition (Unicode policy): which code-point categories constitute a "word character" for the `_`/`*` open/close boundary rule — ASCII letters only, Unicode `\w`, full Unicode letter/number categories? Affects every non-ASCII emphasis case. (new `I.review` item)
- Three-plus adjacent marks (`***x***`): legal as bold-italic shorthand, ambiguous, or error? Tokenization order matters. (new `I.review` item)
- Smart-quote interaction at italic-then-apostrophe boundary (`_keeper_'s`): does the renderer/lexer typographic-quote pass see a closing italic before or after the `'`? Links to M1.01 smart-quote question. (new `I.review` item)
- Digit-then-letter `*` boundary (`5*x*7`): asymmetric — digit on one side, letter on the other. Does the number-boundary rule still suppress emphasis? (new `I.review` item)
- Unclosed emphasis mark across a blank line (negative form of W2.C.2): does an opening `_` or `*` that never closes within its paragraph become literal, error, or auto-close at paragraph break? (new `I.review` item)
- Emphasis-mark character split across CRLF: a `_` or `*` immediately followed by `\r\n` — does newline normalization run before tokenization (mark survives) or after (mark may interact with the CR)? Composes with the M1.00 newline-normalization-order question. (new `I.review` item)

**Convention tightening (M1.01, reinforced M1.02):**
- Narration comments `~ ...` flush against the first prose line (no blank line between narration and the prose it annotates). Applied uniformly across `01-prose/` and `02-emphasis/`. Both reviews flagged drift — call this out explicitly in every future briefing for any category that permits narration. (No further category permits in-fixture narration after `02-emphasis`; the convention dies at `03-comments`.)

**From `03-comments/_notes.md` (M1.03):**
- Comment-node trivia attachment: when a comment is elided from the AST, does it attach as leading/trailing trivia to an adjacent node, or vanish entirely? Affects round-trip / formatter feasibility. (new `I.review` item)
- Whitespace-after-tilde requirement: must `~` be followed by a space to open a line comment (`~ ...`), or is `~foo` also a comment? Disambiguation against `~/path` and `~5`. (new `I.review` item, refines PLAN.md I.1)
- Block comment spanning a blank line: does `~~ ... \n\n ... ~~/` remain one comment, or does the blank line terminate it? (new `I.review` item)
- Indent preservation inside comment payload: leading whitespace on continuation lines of a block comment — preserved verbatim in the comment's text, or normalized? (new `I.review` item)
- `~~` divider semantics inside an open `~~ ... ~~/` block: literal text, structural divider, or attempted nesting? (new `I.review` item)
- `~~~/` closer disambiguation: leftmost-longest match — is `~~~/` parsed as `~~/` preceded by `~`, or as a distinct closer? (new `I.review` item)
- Mid-line `~` after non-space: `foo~bar` — never a comment, but confirm: is this a tokenization rule (must be space-preceded) or a lookbehind during comment-open detection? (new `I.review` item)
- Empty comment shape: `~~ ~~/` vs `~~~~/` — empty comment node, no-op, or error? (new `I.review` item)
- Closer positional restrictions: can `~~/` close at any column / line position, or only at line start / line end? (new `I.review` item)
- Comment as joiner vs separator (probes PLAN.md I.1 + I.2): prose line, line-comment, prose line — one paragraph or two? Composes I.1 (AST-presence) with I.2 (soft-break vs blank-line semantics). (new `I.review` item, composes I.1+I.2)
- CRLF/BOM byte edges inside comments: comment containing CRLF mid-payload, or comment opener after a BOM — interaction with newline normalization pre/post lex (carry-over from M1.00). (new `I.review` item)
- (Plus direct probe of) PLAN.md I.1 — are comments AST nodes or fully elided? Now the central open question for resolver/expander design.

**Accumulated load (M1.00–M1.03):** 28 surfaced `I.review` items across four `_notes.md` files. M1.review will be substantial — schedule a dedicated review pass before M2 begins; expect spec v0.2 / PLAN.md amendments.

---

## Tasks completed

- **Task 1 — M0 scaffold** (merge `8eec37e`): TS monorepo scaffold landed; `pnpm install/typecheck/test/build` all green. pnpm workspace with `packages/parser` (empty AST placeholder) and `tests/runner` workspace stub; root tsconfig solution file with project reference to parser; root vitest config; GitHub Actions CI on Node 20. Ready to receive fixture and parser code.
- **Task 2 — M1.00 lexical fixtures** (merge `38d6e7b`): 13 `.wit` fixtures under `tests/fixtures/00-lexical/` covering empty/minimal inputs, paragraph boundaries, whitespace/tabs, and CR/LF/CRLF newline conventions. Byte-sensitive newline fixtures authored via `printf` and verified with `od -c`. `_notes.md` logs 5 open design questions (see above), each H2 citing PLAN.md `I.x` or flagging an `I.review` item. Established `tests/fixtures/README.md` codifying fixture-authoring conventions (see above). No snapshot runner yet — fixtures sit ready for when it lands.
- **Task 3 — M1.01 prose fixtures** (merge `7ddde39`): 12 `.wit` fixtures under `tests/fixtures/01-prose/` covering single/multi-paragraph prose, blank-line splits, soft line breaks, long single lines, markdown-ish leaders treated as plain prose, punctuation-heavy text, quoted prose, embedded URLs, number/arithmetic shapes, and mid-line `~` cases. Probes PLAN.md I.2 (soft line break) and surfaces 4 new `I.review` items: markdown-ish leader rendering (verbatim/stripped), smart-quote substitution policy, number-shape tokenization inside Text runs, and email-shaped mid-word `@` (extending I.6 with a non-word-boundary requirement). Tightened convention: narration `~ ...` flushes against first prose line (no blank between) — applied uniformly. Cross-category fragility flagged: `numbers-and-arithmetic-shapes.wit` must re-validate when 02-emphasis tokenization lands.
- **Task 4 — M1.02 emphasis fixtures** (merge `3e0f7ea`): 9 `.wit` fixtures under `tests/fixtures/02-emphasis/` covering `_italic_` and `*bold*` baselines, `_*combined*_` nesting, the `_keeper_'s` apostrophe-after-italic edge, `5*6*7` arithmetic-shape suppression, intra-word `snake_case` underscores, empty `__`/`**` marks, marks at paragraph boundaries, and mixed prose+marks runs. `_notes.md` surfaces 7 new `I.review` items: empty-mark semantics, word-character Unicode policy, three-plus adjacent marks (`***x***`), italic-then-apostrophe smart-quote interaction, digit-then-letter `*` asymmetric boundary, unclosed mark across blank line, and emphasis mark split across CRLF. Narration-flush convention from M1.01 reinforced — recurrence in this review means every future briefing for a narration-permitting category must call it out explicitly. (After this category, narration in fixtures dies.)
- **Task 5 — M1.03 comments fixtures** (merge `0d83116`): 8 `.wit` fixtures under `tests/fixtures/03-comments/` covering line-leading `~`, inline `~~ ... ~~/`, multi-line blocks, internal `~~` divider, `~/` path safety inside block bodies, mid-line tilde discriminators, empty comments, and the comment-between-prose-lines paragraph-boundary probe. **First category where in-fixture narration is forbidden** — all explanation lives in `_notes.md`. Directly probes PLAN.md I.1 (comments as AST nodes vs elided). Surfaces 12 new `I.review` items (see above): trivia attachment, whitespace-after-tilde, block-spans-blank-line, payload indent preservation, `~~` divider semantics, `~~~/` leftmost-longest, mid-line `~` lookbehind, empty-comment shape, closer positional restrictions, joiner/separator (composes I.1+I.2), and CRLF/BOM byte edges. Convention reinforced for all forward categories: explanation in `_notes.md` only. Accumulated total: 28 `I.review` items across four notes files; M1.review will be substantial.

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

- **M1.04 — nodes-use fixtures for `tests/fixtures/04-nodes-use/`** is the next dispatch. PLAN section E.1, user stories W4.1–W4.5, plus DS-4. **Narration in `.wit` remains FORBIDDEN from 03 forward** — all explanation lives in `_notes.md`. This category is the first contact with `@name`-references, the central syntactic feature of Wit.
  - Read `/tests/fixtures/README.md` (especially the "no in-fixture narration from 03 forward" clause), `/tests/fixtures/03-comments/_notes.md` (latest format reference and the no-narration convention in practice), and `/examples/` files that exercise `@name` references (notably `15-references/` and any single-feature reference example) for grounding.
  - Scenarios to cover (8–12 fixtures, one purpose each, kebab-case):
    - `block-name-body.wit` — basic `@name ... name@` block form.
    - `inline-name-body.wit` — `@name ... name@` mid-paragraph (inline form).
    - `bare-reference.wit` — `@name` with no body, no closer, no parens — pure reference. Probes I.6 (where does the handle end?).
    - `dotted-access.wit` — `@name.field` dot access (probes PLAN.md I.3 — where dot-access is legal).
    - `hyphenated-name.wit` — `@paper-stats` (hyphen in identifier).
    - `numeric-suffix.wit` — `@h1`, `@h2` (digit-tail identifiers).
    - `underscored-name.wit` — `@chapter_one` (underscore in identifier).
    - `nested-same-name.wit` — `@x @x x@ x@` — closer pairing discipline under name shadowing.
    - `bare-reference-adjacent-prose.wit` — `@weil argued` — direct I.6 probe: handle terminates at whitespace? at punctuation? at apostrophe?
    - `empty-body.wit` — `@x x@` (no content between).
    - **Optional / judgment call:** `mismatched-close.wit` — `@x ... y@`. This may belong in `tests/errors/` rather than `fixtures/04-nodes-use/`. Implementer's call: include with an `_notes.md` note flagging the placement question, or defer to errors/.
  - Create `tests/fixtures/04-nodes-use/_notes.md`. **No narration in `.wit` files.** Expected open questions to surface (each H2 cites PLAN.md `I.x` or flags `I.review`):
    - **PLAN.md I.6 — bare reference boundary** — directly and centrally probed by `bare-reference-adjacent-prose.wit`, `numeric-suffix.wit`, `dotted-access.wit`. Expect concrete proposal in notes.
    - **PLAN.md I.7 — `!!` greedy-parse risk** — not exercised here (no short-close), but flag as the next category's headache; downstream concern worth surfacing now while reference syntax is fresh.
    - PLAN.md I.3 — `@name.field` legal positions — probed by `dotted-access.wit`.
    - Identifier character class (hyphen, digit, underscore — first-char rules, mid-char rules) — likely new `I.review`.
    - Closer-pairing discipline under name shadowing (nested-same-name) — likely new `I.review`.
    - Mismatched-close placement (fixtures/ vs errors/) if included.
  - Avoid `#`-definitions, `*`/`_` emphasis as the test subject, `!!` close, parens on references, pipes — those belong in later categories. Plain prose hosting the references is fine.
  - Do NOT add snapshot `.json` files — snapshot runner has not landed.
  - **Branch:** `m1-04-nodes-use-fixtures`. **Single commit message:** `M1.04: nodes-use fixtures (@name body name@, bare, dotted, edges)`.
- Keep this file under 280 lines. Prune resolved design questions into a separate "Decisions" section once they land. (Currently approaching limit — next memory update should consider pruning oldest scaffold notes.)
