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
- `/tests/fixtures/04-nodes-use/` — 10 node-use fixtures + `_notes.md`: `block-name-body.wit`, `inline-name-body.wit`, `bare-reference.wit`, `bare-reference-adjacent-prose.wit`, `dotted-access.wit`, `hyphenated-name.wit`, `numeric-suffix.wit`, `underscored-name.wit`, `nested-same-name.wit`, `empty-body.wit`. (`mismatched-close` deferred to `tests/errors/` — placement noted as I.review item.) Directly probes I.6, I.3; surfaces 11 new `I.review` items including a CONCRETE PROPOSAL for I.6 bare-reference boundary rule (b).
- `/tests/fixtures/05-nodes-parens/` — 10 parens-form fixtures + `_notes.md`: `single-named-param.wit`, `multiple-params.wit`, `named-and-flag.wit`, `mixed-params.wit`, `hyphen-multi-word-key.wit`, `empty-parens.wit`, `trailing-comma.wit`, `inner-whitespace.wit`, `self-closing.wit`, `parens-then-body.wit`. First contact with `(...)` parameter list syntax; in-fixture narration FORBIDDEN. Directly probes I.12, I.4; flags downstream I.11, I.17. Surfaces 12 new `I.review` items plus CONCRETE PROPOSALS for: I.12 multi-word flag = whole-slot; trailing comma tolerated; inner-whitespace stripped per slot; hyphen-as-separator with surrounding spaces; self-closing classification parity with pipe-form.
- `/tests/fixtures/06-parameters-pipes/` — 12 pipe-form fixtures + `_notes.md`: `basic-named.wit`, `multi-word-value.wit`, `hyphen-multi-word-key.wit`, `bare-positional.wit`, `flag-with-bang.wit`, `multi-word-isolated.wit`, `mid-body-scatter.wit`, `last-one-wins.wit`, `multiple-pipes-per-line.wit`, `empty-pipe.wit`, `pipe-in-body-text.wit`, `literal-hyphen-probe.wit`. First contact with pipe-form `|...|` parameter syntax; in-fixture narration FORBIDDEN. Affirms M1.05 parity (I.12 whole-slot, hyphen-as-separator). New CONCRETE PROPOSALS: bare-positional (no `!`) per PLAN 5.U.3/5.U.4; empty `||` reserved for capture-lists (carved out from body context); last-one-wins as node-scoped two-pass (parse=collect, resolve=collapse). Surfaces 8 new `I.review` items including pipe-shaped text in body, multi-word key delimiter reconciliation, mid-body scatter classification.
- `/tests/fixtures/07-definitions/` — 12 definition fixtures + `_notes.md`: `block-definition.wit`, `single-line-def.wit`, `captures-and-interpolation.wit`, `interpolation-only.wit`, `body-slot.wit`, `multi-line-value.wit`, `captures-body-slot-interpolation.wit`, `single-line-def-with-captures.wit`, `forward-reference.wit`, `definition-references-definition.wit`, `multi-capture-list.wit`, `body-slot-only.wit`. First contact with the definition-side of the language (`#name ... name#`, `#name: value !!`, `#name:\n...\n!!`, `||a, b, c||` capture lists, `::name::` interpolation, `...` body slot). In-fixture narration FORBIDDEN. Directly probes PLAN.md I.7 (`!!` greedy-parse), I.16 (body-slot positioning), I.8 (forward references), I.9 (definition scope); flags I.17 downstream. CONCRETE PROPOSALS surfaced: (1) context-only `!!` (literal in prose, terminator only inside open `#name:` value); (2) at-most-once anywhere body slot `...`; (3) resolved-at-expand-time forward references (subsumes hoisting); (4) global scope within ref graph; (5) context-only `::name::` interpolation (literal outside definition body); (6) `||...||` reserved for capture-list opener position only — composes with M1.06's empty-`||` carve-out; (7) shape classification by opener byte (`#name\n`=block, `#name: ... !!`=single-line, `#name:\n`=value-block). Lean on I.17: `!!` is definition-only. Surfaces 7 H2 sections of `I.review` items.

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

**From `04-nodes-use/_notes.md` (M1.04):**
- **PLAN.md I.6 — bare-reference boundary — CONCRETE PROPOSAL surfaced.** Rule (b): handle character class is `[A-Za-z0-9_-]`; a `.` opens a dot-access path (continues parsing); ALL other bytes (whitespace, punctuation, apostrophe, `@`, EOF) terminate the handle. This is the candidate resolution to feed into M1.review / spec v0.2.
- Trailing hyphen rule: does `@paper-stats-` end the handle at the trailing hyphen or include it? Greedy vs lookahead. (new `I.review` item)
- Sentence-final period disambiguation: `@weil.` — is the `.` a dot-access opener (then handle is `weil` and `.` starts access path expecting a field) or sentence punctuation (terminator)? Resolution interacts with I.3. (new `I.review` item)
- Numeric indices in dot-access path: `@chapter.1` — legal field name or terminator? (new `I.review` item)
- Leading-underscore handle: `@_private` — is `_` legal as first char of handle, or reserved? (new `I.review` item)
- Case sensitivity of handles: `@Foo` vs `@foo` — same handle, distinct handles, or case-folded? (new `I.review` item)
- Closer source location: in `@x ... x@`, does `x@` carry its own loc or attach to the open? Affects diagnostics. (new `I.review` item)
- All-on-one-line nested classification: `@x @x x@ x@` on a single line — inline-nested or block-nested-rendered-inline? (new `I.review` item)
- Inter-marker space in empty body: `@x x@` vs `@xx@` — required space between open and close? Tokenization rule. (new `I.review` item)
- Block-then-prose paragraph fusion: when a block node ends mid-paragraph, does following prose attach to the same paragraph or open a new one? (new `I.review` item)
- Mismatched-close placement (`errors/` vs `04-nodes-use/`): the meta-question itself, recorded as I.review. Deferred to errors/ for now.
- Unicode handle policy: non-ASCII letters in `@name` — extends emphasis Unicode question (M1.02) to identifiers. (new `I.review` item)

**From `05-nodes-parens/_notes.md` (M1.05):**
- **PLAN.md I.12 — multi-word flag scoping — CONCRETE PROPOSAL surfaced.** A multi-word flag terminated by `!` (e.g. `full width!`) parses as a single whole-slot flag; the `!` belongs to the slot, not the trailing word. Ready to ratify at M1.review.
- **Trailing comma — CONCRETE PROPOSAL.** Tolerated: `@x(a,)` parses identically to `@x(a)`; trailing empty slot is discarded.
- **Inner-whitespace — CONCRETE PROPOSAL.** Strip leading/trailing whitespace per slot after comma-split; preserve internal single spaces for multi-word keys/values.
- **Hyphen-as-separator — CONCRETE PROPOSAL.** ` - ` (hyphen with surrounding spaces) separates multi-word key from multi-word value; bare `-` inside a word is literal (e.g. `well-known` is a single token).
- **Self-closing classification — CONCRETE PROPOSAL.** Parens-form with no trailing body achieves parity with pipe-form self-close: `@badge(tone good)` is self-closing iff no body content follows on the same construct.
- PLAN.md I.4 — parameter value quoting — flagged: no fixture needed quoting; concrete chars triggering quote requirement (comma, paren, `!`, leading `-`) remain open. (new `I.review` item)
- PLAN.md I.11 — mixing parens and pipes — flagged downstream for M1.06.
- PLAN.md I.17 — combining `!!` close with parens — flagged downstream for M1.07.
- Empty-parens semantics: `@x()` legal/no-op/error. (new `I.review` item)
- Parens+body without pipes (`@name(p) body name@`) — distinct subquestion of I.11; flagged as new I.review.
- Hyphen disambiguator: `|well-known|` (positional) vs `|key - value|` (named) — formalize the surrounding-space rule. (new `I.review` item)
- 12 new I.review items total including downstream I.11 + I.17 flags.

**From `06-parameters-pipes/_notes.md` (M1.06):**
- **PLAN.md I.12 — multi-word flag — PIPE-SIDE PARITY AFFIRMED.** `|full width!|` parses as flag with name `full width` (whole-slot rule). Matches M1.05 parens-side proposal exactly.
- **Hyphen-as-separator — PIPE-SIDE PARITY AFFIRMED.** ` - ` (space-hyphen-space) marks the key/value boundary; bare `-` inside a word is identifier/value bytes. Matches M1.05.
- **Bare-positional vs flag — CONCRETE PROPOSAL.** `|full|` (no `!`) parses as `Positional("full")` per PLAN 5.U.3/5.U.4. Flag REQUIRES trailing `!`; no `!` means no flag, period.
- **Empty pipe `||` — CONCRETE PROPOSAL.** Errors inside body context per PLAN 5.U.7; `||` token reserved for capture-list opener context (DS-6 / 6.U.1). The "inside body, not capture" qualifier in 5.U.7 reads as exactly this carve-out.
- **Last-one-wins — CONCRETE PROPOSAL (two-pass).** Parser collects all slots regardless of position (faithful to 5.C.1 "collected regardless of position"); resolver collapses to last-one-wins per key (faithful to 5.C.3). Override logic lives in `packages/runtime/resolver.ts`.
- **Multi-word key delimiter — CONCRETE PROPOSAL.** First-space-or-hyphen rule: if ` - ` appears before the first plain space, split key/value at ` - `; otherwise split at the first space. Faithful to 5.U.1 + 5.U.2.
- I.4 — parameter value quoting — flagged: pipe `|` inside value needs an escape mechanism that does not yet exist. Three rough options surfaced (rephrase / backslash / quoted-string slot).
- I.11 — mixing parens + pipes — flagged downstream from the pipes side (lean: error — parens self-closes, pipes implies open body, contracts mutually exclusive).
- Pipe-shaped text in body — CONCRETE PROPOSAL: slot recognition requires positional context; mid-paragraph `|...|` is literal punctuation. Reuses the inline/block classifier machinery (4.S.2).
- Mid-body scatter classification — node-scoped flat collection (parse) + last-one-wins collapse (resolve).
- File-edge deferrals: mid-value `!`, pipes+parens on same node, literal `|` in value, capture-list `||` overlap, access-path key inside pipes, whitespace-only `| |` slot.
- 8 new `I.review` items total.

**From `07-definitions/_notes.md` (M1.07):**
- **PLAN.md I.7 — `!!` greedy-parse risk — CONCRETE PROPOSAL.** Context-only `!!`: terminator only inside an open `#name:` value; literal two-byte `!!` everywhere else (prose, body, slot content). Reuses the "currently inside definition value" machinery. Rules out a corpus-wide escape audit.
- **PLAN.md I.16 — body slot positioning — CONCRETE PROPOSAL.** At-most-once, any position. Multiple `...` markers in one definition body is an error. (Note: I.16's original framing was about short-close `!!`; this proposal repurposes it to body-slot positioning since `!!` is now owned by definition values.)
- **PLAN.md I.8 — forward references — CONCRETE PROPOSAL.** Resolved-at-expand-time (resolver stage owns the lookup); subsumes full hoisting. Authors see hoisted behavior; parser emits unresolved `@x` and `#x`, resolver binds regardless of source order.
- **PLAN.md I.9 — definition scope — CONCRETE PROPOSAL.** Global within reference graph (affirms PLAN lean). In-file fixture pins the trivial case; cross-file deferred to M1.15.
- **Interpolation context — CONCRETE PROPOSAL.** `::name::` recognized as interpolation ONLY inside a definition body; literal text everywhere else. Parity with the I.7 context-only `!!` rule — same "inside definition" predicate gates both.
- **Capture-list `||` reservation — CONCRETE PROPOSAL.** `||...||` is the capture-list syntax in definition-opener position ONLY. Outside that position, M1.06's body-context empty-`||` rule applies. Composes the two into one unified `||` rule.
- **Definition shape classification — CONCRETE PROPOSAL.** Lexer commits to shape by opener byte: `#name\n` → block; `#name: ... !!` → single-line; `#name:\n` → value-block. AST records `NodeDef.shape` for round-trip preservation.
- I.17 — `!!` close + parens — LEAN (not committed): `!!` is definition-only; using it as a use-side close is an error or literal. Cleaner separation; keeps `!!` semantics narrow.
- Open under proposals: nested definitions, definition redefinition, undeclared-capture interpolation, capture-name character class (Unicode policy carry-over), mixed-line shape edge cases, empty single-line value `#name: !!`, four-dot ambiguity (`....`), literal `...` ellipsis inside single-line value.

**Accumulated load (M1.00–M1.07):** ~60+ surfaced `I.review` items across eight `_notes.md` files plus **16 CONCRETE PROPOSALS + 1 LEAN** ready to ratify (I.6 from M1.04; I.12 + 4 from M1.05; pipe-side affirmation + 4 new from M1.06; 7 new + I.17 lean from M1.07). M1.review will be substantial — schedule a dedicated review pass before M2 begins; expect spec v0.2 / PLAN.md amendments. **Memory pruning is overdue** — next memory update should compact per-category "Surfaced design questions" into one-line digests, or move them to a sibling `design-questions.md`.

---

## Tasks completed

- **Task 1 — M0 scaffold** (merge `8eec37e`): TS monorepo scaffold landed; `pnpm install/typecheck/test/build` all green. pnpm workspace with `packages/parser` (empty AST placeholder) and `tests/runner` workspace stub; root tsconfig solution file with project reference to parser; root vitest config; GitHub Actions CI on Node 20. Ready to receive fixture and parser code.
- **Task 2 — M1.00 lexical fixtures** (merge `38d6e7b`): 13 `.wit` fixtures under `tests/fixtures/00-lexical/` covering empty/minimal inputs, paragraph boundaries, whitespace/tabs, and CR/LF/CRLF newline conventions. Byte-sensitive newline fixtures authored via `printf` and verified with `od -c`. `_notes.md` logs 5 open design questions (see above), each H2 citing PLAN.md `I.x` or flagging an `I.review` item. Established `tests/fixtures/README.md` codifying fixture-authoring conventions (see above). No snapshot runner yet — fixtures sit ready for when it lands.
- **Task 3 — M1.01 prose fixtures** (merge `7ddde39`): 12 `.wit` fixtures under `tests/fixtures/01-prose/` covering single/multi-paragraph prose, blank-line splits, soft line breaks, long single lines, markdown-ish leaders treated as plain prose, punctuation-heavy text, quoted prose, embedded URLs, number/arithmetic shapes, and mid-line `~` cases. Probes PLAN.md I.2 (soft line break) and surfaces 4 new `I.review` items: markdown-ish leader rendering (verbatim/stripped), smart-quote substitution policy, number-shape tokenization inside Text runs, and email-shaped mid-word `@` (extending I.6 with a non-word-boundary requirement). Tightened convention: narration `~ ...` flushes against first prose line (no blank between) — applied uniformly. Cross-category fragility flagged: `numbers-and-arithmetic-shapes.wit` must re-validate when 02-emphasis tokenization lands.
- **Task 4 — M1.02 emphasis fixtures** (merge `3e0f7ea`): 9 `.wit` fixtures under `tests/fixtures/02-emphasis/` covering `_italic_` and `*bold*` baselines, `_*combined*_` nesting, the `_keeper_'s` apostrophe-after-italic edge, `5*6*7` arithmetic-shape suppression, intra-word `snake_case` underscores, empty `__`/`**` marks, marks at paragraph boundaries, and mixed prose+marks runs. `_notes.md` surfaces 7 new `I.review` items: empty-mark semantics, word-character Unicode policy, three-plus adjacent marks (`***x***`), italic-then-apostrophe smart-quote interaction, digit-then-letter `*` asymmetric boundary, unclosed mark across blank line, and emphasis mark split across CRLF. Narration-flush convention from M1.01 reinforced — recurrence in this review means every future briefing for a narration-permitting category must call it out explicitly. (After this category, narration in fixtures dies.)
- **Task 5 — M1.03 comments fixtures** (merge `0d83116`): 8 `.wit` fixtures under `tests/fixtures/03-comments/` covering line-leading `~`, inline `~~ ... ~~/`, multi-line blocks, internal `~~` divider, `~/` path safety inside block bodies, mid-line tilde discriminators, empty comments, and the comment-between-prose-lines paragraph-boundary probe. **First category where in-fixture narration is forbidden** — all explanation lives in `_notes.md`. Directly probes PLAN.md I.1 (comments as AST nodes vs elided). Surfaces 12 new `I.review` items (see above): trivia attachment, whitespace-after-tilde, block-spans-blank-line, payload indent preservation, `~~` divider semantics, `~~~/` leftmost-longest, mid-line `~` lookbehind, empty-comment shape, closer positional restrictions, joiner/separator (composes I.1+I.2), and CRLF/BOM byte edges. Convention reinforced for all forward categories: explanation in `_notes.md` only. Accumulated total: 28 `I.review` items across four notes files; M1.review will be substantial.
- **Task 6 — M1.04 nodes-use fixtures** (merge `ad79997`): 10 `.wit` fixtures under `tests/fixtures/04-nodes-use/` covering block-form `@name ... name@`, inline form, bare `@name` reference, bare reference adjacent to prose (direct I.6 probe), `@name.field` dot-access (I.3), hyphenated/numeric-suffix/underscored identifiers, nested same-name shadowing, and empty body `@x x@`. `mismatched-close` deferred to `tests/errors/`. **First contact with the central `@name`-reference syntactic feature.** **CONCRETE PROPOSAL for I.6 surfaced in `_notes.md`** — rule (b): handle class `[A-Za-z0-9_-]`; `.` opens dot-access path; all other bytes terminate. 11 new `I.review` items surfaced (trailing hyphen, sentence-final period vs I.3, numeric dot-access indices, leading-underscore, case sensitivity, closer source location, all-on-one-line nesting, inter-marker space, block-then-prose paragraph fusion, mismatched-close placement, Unicode handles). Accumulated total: ~40 `I.review` items across five notes files; I.6 proposal ready to ratify at M1.review.
- **Task 7 — M1.05 nodes-parens fixtures** (merge `231f8b0`): 10 `.wit` fixtures under `tests/fixtures/05-nodes-parens/` covering single named param, multiple params, named+flag, mixed-form (multi-word flag), hyphen-multi-word-key, empty parens, trailing comma, inner whitespace, self-closing classification, and parens+body without pipes. **First contact with the `(...)` parameter-list syntax; in-fixture narration FORBIDDEN.** Directly probes PLAN.md I.12 (multi-word flag) and I.4 (parameter value quoting); flags downstream I.11 (mixing parens+pipes) and I.17 (`!!` close + parens). `_notes.md` surfaces **5 CONCRETE PROPOSALS**: (1) I.12 — multi-word flag terminated by `!` parses as whole-slot flag; (2) trailing comma tolerated; (3) inner-whitespace stripped per slot, internal single spaces preserved; (4) hyphen-as-separator requires surrounding spaces (` - `) — bare `-` is literal; (5) self-closing classification parity with pipe-form. Plus 12 new `I.review` items including downstream I.11 and I.17 placeholders. Accumulated total: ~52 `I.review` items across six notes files; 6 concrete proposals (I.6 + 5 from M1.05) ready to ratify at M1.review.
- **Task 8 — M1.06 parameters-pipes fixtures** (merge `576a845`): 12 `.wit` fixtures under `tests/fixtures/06-parameters-pipes/` covering basic-named, multi-word value, hyphen-multi-word-key, bare-positional, flag-with-bang, multi-word-isolated, mid-body-scatter, last-one-wins, multiple-pipes-per-line, empty-pipe, pipe-in-body-text, literal-hyphen-probe. **First contact with pipe-form `|...|` parameter syntax; in-fixture narration FORBIDDEN.** Affirms M1.05 parity for I.12 (whole-slot multi-word flag) and hyphen-as-separator. New CONCRETE PROPOSALS: bare-positional `|full|` (no `!`) parses as `Positional("full")` per PLAN 5.U.3/5.U.4 — flag REQUIRES trailing `!`; empty `||` errors in body context BUT is reserved as the opener token for capture-lists (DS-6 / 6.U.1); last-one-wins as a node-scoped TWO-PASS design (parser collects all slots faithful to "regardless of position"; resolver collapses to last-one-wins per key). Surfaces 8 new `I.review` items: I.4 quoting (pipe `|` inside value), I.11 downstream (mixing parens+pipes), pipe-shaped text in body (lean: slot recognition is position-sensitive, mid-paragraph `|...|` is literal), hyphen-as-separator parity, mid-body scatter classification, multi-word key delimiter reconciliation (first-space-or-hyphen rule), and file-edge deferrals. Accumulated total: ~60 `I.review` items across seven notes files; 9 concrete proposals ready to ratify at M1.review.
- **Task 9 — M1.07 definitions fixtures** (branch `m1-07-definitions-fixtures`): 12 `.wit` fixtures under `tests/fixtures/07-definitions/` covering block definition (`#name ... name#`), single-line def (`#name: value !!`), captures + interpolation (`#name ||a, b|| ... ::a:: ...`), interpolation-only, body slot (`...`), multi-line value (`#name:\n ... \n!!`), captures+body-slot+interpolation, single-line def with captures, forward reference, definition referencing another definition, multi-capture-list, and body-slot-only. **First contact with the DEFINITION-side of the language; in-fixture narration FORBIDDEN.** Directly probes PLAN.md I.7 (`!!` greedy-parse risk), I.16 (body-slot positioning — repurposed from short-close), I.8 (forward references), I.9 (definition scope); leans on I.17 downstream. `_notes.md` surfaces **7 CONCRETE PROPOSALS**: (1) I.7 — context-only `!!` (terminator only inside open `#name:` value; literal in prose); (2) I.16 — body slot `...` at-most-once, any position; (3) I.8 — resolved-at-expand-time (subsumes full hoisting); (4) I.9 — global within ref graph (in-file fixture pins the trivial case); (5) `::name::` interpolation is context-only (literal outside definition body — parity with I.7 proposal); (6) `||...||` reserved for capture-list opener position ONLY — composes with M1.06's empty-`||` body-context carve-out into one unified rule; (7) definition shape classification by opener byte (`#name\n`=block, `#name: ... !!`=single-line, `#name:\n`=value-block). Plus a LEAN on I.17: `!!` is definition-only, not a use-side close. Surfaces 7 H2 sections of `I.review` items including nested definition scope, definition redefinition, undeclared-capture interpolation, capture-list character class, and shape mixed-line edge cases. Accumulated total: ~60+ `I.review` items across eight notes files; 16 concrete proposals + 1 lean ready to ratify at M1.review.

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

- **M1.08 — additive partials fixtures for `tests/fixtures/08-additive-partials/`** is the next dispatch. PLAN section E.1 + DS-7 (W?.* — check PLAN for additive partials story IDs). **Narration in `.wit` remains FORBIDDEN.** First contact with `+#name` additive-partial prefix. Implementer must build on M1.07 definition fixtures (block, single-line, value-block) and probe how `+#name` merges with an existing `#name`. Open territory carried from M1.07: definition redefinition (`#x` twice in one file) is currently an "error unless `+#x` additive" lean; M1.08 commits the additive side. Cross-reference `examples/16-additive-partials/` for grounding. Branch: `m1-08-additive-partials-fixtures`. Commit: `M1.08: additive-partials fixtures (+#name merge, edges)`.
- **Memory pruning is OVERDUE** — this file is ~270+ lines after M1.07 added 7 new proposals. Strongly recommend the next memory update either (a) compact per-category "Surfaced design questions" into one-line digests, or (b) move them to a sibling `design-questions.md` and keep this file the high-level index. Carry forward.
- **M1.review preparation** — the surface area is now substantial: 16 concrete proposals + 1 lean across PLAN.md I.4, I.6, I.7, I.8, I.9, I.11, I.12, I.16, I.17 plus ~7 new I.review composite rules (capture-list reservation, interpolation context, shape classification, last-one-wins two-pass, etc.). Before M2 begins, schedule a dedicated M1.review pass that produces (1) a spec v0.2 update, (2) PLAN.md I.x resolutions, (3) a refreshed open-questions list for the resolver/expander phase.

## (Archived) Notes from M1.06 cycle

- **M1.06 — nodes-pipes (parameters) fixtures for `tests/fixtures/06-nodes-pipes/`** is the next dispatch. PLAN section E.1 W5.1–W5.6 + DS-5. **Narration in `.wit` remains FORBIDDEN.** First contact with pipe-form parameters `|key value|` / `|positional|` / `|flag!|`. Implementer must commit to parity with M1.05 proposals OR explicitly diverge in `_notes.md`.
  - Read `/tests/fixtures/README.md`, `/tests/fixtures/05-nodes-parens/_notes.md` (latest format reference; emulate the CONCRETE PROPOSAL form for any new proposals), and `/examples/` files that exercise pipes for grounding. Note PLAN file rule: `|key value|` — first word is key, rest is value; flag form REQUIRES trailing `!`; bare single-word slot (no `!`) is POSITIONAL, not flag.
  - Scenarios to cover (kebab-case, one purpose each):
    - `basic-named.wit` — `|mood calm|` basic named, single-word key + single-word value.
    - `multi-word-value.wit` — `|caption The second-order Fresnel lens|` single-word key + multi-word value (verify the "first word is key, rest is value" rule).
    - `hyphen-multi-word-key.wit` — `|background colour - dark slate|` multi-word key with hyphen separator (verify M1.05 surrounding-space hyphen-separator proposal applies to pipes too).
    - `bare-positional.wit` — `|full|` single word, no `!` — should parse as POSITIONAL per PLAN rule (flag rule requires trailing `!`). Verify with implementer.
    - `flag-with-bang.wit` — `|full width!|` flag with trailing `!`, multi-word slot (parity probe for M1.05 I.12 whole-slot proposal).
    - `multi-word-isolated.wit` — `|multi word value with space|` same shape as caption case but isolated in its own fixture for clarity (probes "first word = key" rule unambiguously).
    - `mid-body-scatter.wit` — multiple `|p|` in different positions inside a single node body (probes last-one-wins ordering for same-key duplicates across positions).
    - `last-one-wins.wit` — same key twice with different values; later wins.
    - `multiple-pipes-per-line.wit` — `@x |a x| |b y| ... x@` multiple pipe-slots on the same line inside a node body.
    - `empty-pipe.wit` — `||` empty pipe — error, no-op, or empty positional? New I.review territory.
    - `pipe-in-body-text.wit` — pipe-shaped text inside body content that is NOT a parameter slot (no matching node opener) — does it parse as plain text or error? New I.review.
    - `literal-hyphen-probe.wit` — `|well-known|` (positional, bare hyphen as part of word) vs `|key - value|` (named, hyphen as separator with surrounding spaces) — disambiguator parity with M1.05 hyphen-separator proposal.
  - Create `tests/fixtures/06-nodes-pipes/_notes.md`. **No narration in `.wit` files.** Expected open questions to surface (each H2 cites PLAN.md `I.x` or flags `I.review`):
    - **PLAN.md I.11 — mixing parens and pipes** — not directly exercised here (pipes only), but pipes-side semantics defined now constrain the I.11 resolution. Cross-reference M1.05 `_notes.md`.
    - **PLAN.md I.12 — multi-word flag scoping** — `flag-with-bang.wit` is the pipe-form parity probe for M1.05's whole-slot proposal. Implementer must explicitly affirm or diverge.
    - **PLAN.md I.4 — parameter value quoting** — multi-word values exercise unquoted forms; flag whether any value would NEED quoting (pipe `|`, `!`, leading `-`).
    - Bare-positional vs flag disambiguation rule — `|full|` is positional (PLAN rule: flag requires `!`). New `I.review` formalizing the lookahead.
    - Last-one-wins ordering — does "later wins" apply per-key globally across the node body, or only within the parens slot list? Pipes scatter across body so this needs explicit answer. New `I.review`.
    - Empty pipe `||` semantics — error / no-op / empty positional. New `I.review`.
    - Pipe-shaped text inside body content (not a slot) — literal text, error, or position-restricted? New `I.review`.
    - Hyphen-as-separator parity with M1.05 proposal — affirm or diverge. New `I.review`.
    - Mid-body scatter classification — does a pipe slot anywhere inside the body attach to the enclosing node, or only at the node opener? New `I.review`.
    - Multi-word key delimiter inside pipes — same `first word = key, rest = value` rule, or different from the `key - value` named form? Reconcile. New `I.review`.
  - Avoid `#`-definitions, `!!` close, refs without pipes (those are later milestones). Plain prose + `@x ... x@` bodies hosting the pipe slots are fine. Mixing parens AND pipes on the same node is OUT OF SCOPE for this milestone (that's I.11 / a later category).
  - Do NOT add snapshot `.json` files — snapshot runner has not landed.
  - **Branch:** `m1-06-parameters-pipes-fixtures`. **Single commit message:** `M1.06: parameters-pipes fixtures (|p|, last-one-wins, edges)`.
- **Memory pruning still pending.** This file is ~250+ lines. Next memory update should compact per-category "Surfaced design questions" into one-line digests, or move them to a sibling `design-questions.md`. Carry forward.
