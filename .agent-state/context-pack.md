# context-pack — active orchestration artifact (RULES.md rule 6)

The implementer's only mandatory read. Decisions and history live in git
(commit messages, `_notes.md` files merged to main, `tests/M1-REVIEW.md`,
`tests/M1-RECONCILIATIONS.md`, `PLAN.md` section I). The implementer
codes blind to prior decisions and writes for the current task's local
scope. Downstream-conflict checking happens at the **reviewer** stage,
not here.

## 1. How to use this pack

You are an implementer for one Wit task. Read this pack. Skim the
current task brief (section 4). Author the files for your scope.
Self-review against section 3. Commit on a fresh branch. Return ≤ 20
lines per section 5. Don't read PLAN.md or prior `_notes.md` unless
you need a specific spec citation — and even then, just the line(s)
you need.

## 2. Conventions

**General:**
- Files <350 lines (RULES 1). Functions <20 lines with local helpers (RULES 2).
- Filenames kebab-case in fixtures and tests.
- Stay inside your task's scope. Do NOT run `git checkout`, `git restore`,
  `git reset --hard`, or any command that discards changes to files outside
  your task. The main session manages shared files; you never reset them.

**Fixture authoring (M1 categories):**
- Narration `~ ...` inside `.wit` is forbidden from `03-comments/` onward.
  All explanatory text in `_notes.md`.
- One `.wit` file = one purpose. No "and" in fixture filenames.
- Each `_notes.md` H2 cites `PLAN.md I.x` OR `(no PLAN.md entry — new I.review item)`.
- Each open-question H2 has a `**Concrete proposal:**` line committing to
  rule (a) / (b) / (c). It's a lean for review, not a final decision.
- Byte-sensitive fixtures: author via `printf`, verify with `od -c`,
  record the invocation in `_notes.md`.

**Code (M2+ TypeScript):**
- ESM only. `.js` extensions in TS imports (`import { x } from './foo.js'`).
- TS strict mode (already in tsconfig). No `any`. No `// @ts-ignore`.
- One concept per file. AST in `ast.ts`, tokens in `tokens.ts`, lexer in
  `lexer.ts`, parser in `parser.ts`, errors in `errors.ts`.
- Discriminated unions over enums. Tagged objects (`{ kind: 'paragraph', ... }`).
- Source locations on every AST node: `{ file, line, col, length }`.
- Errors typed: `WitError` with `code`, `message`, `loc`.
- Co-locate unit tests as `foo.test.ts` next to `foo.ts`. Vitest, ESM.
- No new runtime `dependencies` in `packages/parser/package.json` (DS-18).
  Dev deps allowed.

**Locked design decisions you need to honor (M2 onward):**
- I.36 handle class is ASCII-only `[A-Za-z0-9_-]` for v1.0.
- I.4 backslash escapes the four reserved chars in param values:
  `\|`, `\,`, `\!`, `\\`. Elsewhere `\` is literal.
- R2/R5 `!!` is definition-only for v1.0. Use-side short-close
  (`@x body !!`) is rejected — `@x(body)` parens-form replaces it.
  M1.04 short-close fixtures will be re-classified during M2.
- See `packages/parser/spec/double-bang-lexer.md` for `!!` state machine.
- See `PLAN.md` section C "Resolution timing" for stage assignment.

## 3. Self-review checklist (run before committing)

**Fixture tasks:**
- [ ] If category ≥ 03: `grep -rE "^~ " <category>/*.wit` returns nothing.
- [ ] All filenames kebab-case, no "and" in any filename.
- [ ] Every `_notes.md` H2 matches the citation form (I.x or new I.review).
- [ ] Each open-question H2 has a `**Concrete proposal:**` line.
- [ ] `_notes.md` under 600 lines; each fixture under 30 lines.

**Code tasks:**
- [ ] All source files under 350 lines; if any nears the cap, split.
- [ ] No function over 20 lines; extract local helpers.
- [ ] All TS imports use `.js` extension.
- [ ] No `any`, no `@ts-ignore`. `pnpm typecheck` exits 0.
- [ ] Co-located `.test.ts` for any non-trivial logic.
- [ ] `packages/parser/package.json` `dependencies` field still absent.
- [ ] `pnpm test`, `pnpm build` exit 0.

## 4. Current task brief

```
TASK: M7.datadef-classify — Reclassify #name: {record}/[collection] as DataDef
BRANCH: m7-datadef-classify
COMMIT: M7.datadef-classify: single-line defs with pure record/collection bodies become DataDef

SCOPE: Big structural fix. Currently `#x: { a - 1 }` parses as a
NodeDef whose body is a Record literal. That makes `lh.data.x` empty
and `@x.a` access fail to resolve. After this task:

1. Parser detects when a `#name:` single-line def's value is EXCLUSIVELY
   a Record or Collection literal (no other content). When that's the
   case, emit a DataDef AST node instead of a NodeDef.
2. Resolver collects DataDef nodes into `resolver.dataDefs` (it already
   has the map; it's just always empty today).
3. Expander's access-path resolution looks in dataDefs first when
   resolving `@x.field`-style references.
4. lh.data exposes those dataDefs as a plain JS object proxy.

DETECTION RULE (parser-defs.ts):
- During single-line def value capture, if the trimmed value starts
  with `{` and the matching `}` ends the value (or starts with `[` and
  the matching `]` ends), parse the value as a DataValue and emit a
  DataDef.
- If the value contains other content (text mixed with the literal),
  keep it as NodeDef with body containing the Record/Collection AST.
  E.g. `#cite: ::author:: (::year::) !!` stays NodeDef.

ALSO INCLUDE: the small emphasis-close-newline whitespace bug —
`<em>x</em>\nword` should render as `<em>x</em> word` not
`<em>x</em>word`. Same root cause as the @-ref / <% %> case, just
applied to EmphasisClose.

REPRODUCER (do not commit):
```
#paper: { word target - 5000, status - draft } !!

The target is @paper.word_target words.
The status is @paper.status.

<% lh.set('paper.word count', lh.prose().wordCount()) %>

Count so far: @paper.word_count words.

A note in _italic_
should preserve the space.
```

Expected after fix:
- "The target is 5000 words."
- "The status is draft."
- "Count so far: <N> words."
- "A note in <em>italic</em> should preserve the space."

FILES TO EDIT (likely):
- packages/parser/src/parser-defs.ts (DataDef classification)
- packages/runtime/src/resolver.ts (DataDef collection / access)
- packages/runtime/src/expander-conditions.ts (resolveAccessPath)
- packages/runtime/src/lh-bridge.ts (lh.data over dataDefs)
- packages/parser/src/lexer-nodes.ts or similar (emphasis-close newline)
- Snapshot regen via WIT_SNAPSHOT_UPDATE=1

REGRESSION TESTS:
- parser-defs.test.ts: `#x: { a - 1 } !!` → DataDef, not NodeDef.
- parser-defs.test.ts: `#x: text !!` and `#x: ::y:: (text) !!` still
  NodeDef (not all-record-value).
- expander.test.ts or lh-bridge.test.ts: `lh.data.x.a === '1'` for a
  DataDef-classified record.
- expander.test.ts: `@x.field` resolves through dataDefs.
- New emphasis-newline regression in lexer or expander tests.

OUT OF SCOPE: collection iteration over a DataDef-classified
collection (probably already works once dataDefs is populated, but
don't expand scope to fix if it doesn't).

PROCEDURE:
1. git checkout -b m7-datadef-classify
2. Detect + reclassify in parser.
3. Wire resolver + expander to use dataDefs.
4. Fix emphasis-newline polish.
5. Regenerate snapshots with WIT_SNAPSHOT_UPDATE=1.
6. pnpm typecheck/test/build exit 0.
7. Single commit.
```

## 5. Return format contract

Implementer returns exactly this block, ≤ 20 lines:

```
Branch: <name>
SHA: <first 7>
Summary: <one line>
New I.review items: <bullet list, or "none">
Self-review: <pass | needs review of X>
Deviations from briefing: <bullet list, or "none">
```

NO source code, NO type-definition dumps, NO full diffs.

## Notes for the main session

- Update section 4 (current task brief) before each implementer dispatch.
- Decisions are NOT tracked here. They live in git history and
  `tests/M1-REVIEW.md` / `M1-RECONCILIATIONS.md` / `PLAN.md` section I.
- Downstream-conflict checks happen at the periodic reviewer stage
  (every 3–4 merged tasks).
- If this file drifts past 250 lines, compact section 4 or trim
  redundant convention bullets.
