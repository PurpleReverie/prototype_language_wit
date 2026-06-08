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
TASK: M2.types — AST + token type definitions
BRANCH: m2-types
COMMIT: M2.types: AST + token type definitions

SCOPE: Define the discriminated-union AST types in
packages/parser/src/ast.ts and the token-stream types in
packages/parser/src/tokens.ts. NO runtime code. NO functions. Just
types and the source-location type. This is the foundation everything
else builds on.

FILES TO CREATE / EDIT:
- packages/parser/src/ast.ts — full AST node types (the file currently
  exists as a stub; replace with real types).
- packages/parser/src/tokens.ts — token type discriminated union.
- packages/parser/src/loc.ts — `SourceLocation` type, `Loc` helper type
  shared between ast.ts and tokens.ts.
- packages/parser/src/index.ts — re-export from new files (already
  re-exports ast.ts; extend to tokens and loc).

REQUIRED AST NODE TYPES (discriminated by `kind` field, all carry `loc`):
- Document { kind: 'document', children: Block[] }
- Paragraph { kind: 'paragraph', children: Inline[] }
- Text { kind: 'text', value: string }
- Italic { kind: 'italic', children: Inline[] }
- Bold { kind: 'bold', children: Inline[] }
- Comment { kind: 'comment', text: string, inline: boolean }
- NodeUse { kind: 'nodeUse', name: string, access?: string[],
            params: Param[], paramsSource: 'parens' | 'pipes' | 'mixed' | 'none',
            body: (Block | Inline)[] | null, inline: boolean,
            closeStyle: 'named' | 'parens' | 'bare' }
- NodeDef { kind: 'nodeDef', name: string, captures: string[],
            shape: 'block' | 'single-line' | 'value-block',
            body: (Block | Inline)[], additive: boolean }
- DataDef { kind: 'dataDef', name: string, value: DataValue }
- Record { kind: 'record', fields: { key: string, value: DataValue }[] }
- Collection { kind: 'collection', items: DataValue[] }
- ReferenceDirective { kind: 'reference', path: string }
- IfStatement { kind: 'ifStatement', cond: Condition, then: Block[], else?: Block[] }
- EachStatement { kind: 'eachStatement', collection: AccessPath, itemName: string, body: Block[] }
- ScriptBlock { kind: 'scriptBlock', content: string, inline: boolean }
- ScriptCall { kind: 'scriptCall', fnName: string, args: string[] }
- Interpolation { kind: 'interpolation', name: string }
- BodySlot { kind: 'bodySlot' }
- Block, Inline as union types

REQUIRED TOKEN TYPES (Token = discriminated union of):
- TextRun, ParagraphBreak, EmphasisOpen, EmphasisClose, LineComment,
  BlockCommentOpen, BlockCommentClose, BlockCommentContent, NodeOpen,
  NodeClose, Dot, ParenOpen, ParenClose, PipeOpen, PipeClose, Comma,
  Hyphen-Separator, Bang, BangBang, DoubleBangSlash (~~/),
  CaptureOpen (||), CaptureClose (||), InterpolationOpen (::),
  InterpolationClose (::), BodySlotMarker (...),
  ParenStatementOpen (`(`), Keyword (`if`/`else`/`end`/`each`/`as`/`is`/`equals`),
  ScriptOpen (<%), ScriptClose (%>), HashOpen (#), HashClose (#),
  AdditivePrefix (+), RecordOpen ({), RecordClose (}),
  CollectionOpen ([), CollectionClose (]), ValueBlockTerminator (!!),
  EOF.

REQUIRED LOC TYPE:
- SourceLocation { file: string, line: number, col: number, offset: number, length: number }

OUT OF SCOPE:
- Lexer implementation (next task).
- Parser implementation.
- Error type — keep that for the lexer task.

PROCEDURE:
1. git checkout -b m2-types
2. Read packages/parser/src/index.ts (current stub) for shape.
3. Write the three new files + replace ast.ts.
4. pnpm typecheck must exit 0.
5. pnpm test must exit 0 (no tests yet, --passWithNoTests).
6. pnpm build must exit 0.
7. Single commit on m2-types.
8. Do NOT push, do NOT merge.
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
