# tests/errors — notes

This category houses fixtures whose `.wit` input is **intentionally
malformed**. Each `<name>.wit` has a sibling `<name>.err.json` describing
the expected error shape:

```
{ "code": "E_...", "message_contains": "...", "loc": { "line": N, "col": N } }
```

`message_contains` is a lowercase substring the diagnostic must include —
deliberately loose so the parser/resolver can phrase the full message
freely. `loc` points to the most useful caret position for a reader
fixing the file, not necessarily the first byte that confused the
parser. All offsets are 1-indexed.

Each H2 below groups one stable error code (DS-15). Cycles, missing
files, and missing fields are resolver-stage; the rest are parser-stage
unless called out.

## Lex / parser closers — E_UNCLOSED_NODE, E_MISMATCHED_CLOSE (no PLAN.md entry — new I.review item)

- `unclosed-node.wit` opens `@x` and never emits `x@` before EOF. Fires
  at the **opener** location (line 1, col 1) so the diagnostic points
  at the construct the author forgot to close, not at EOF.
- `mismatched-close.wit` opens `@x` then closes with `y@`. Reported at
  the closer (line 3) so the user sees the wrong name with a caret.
- Stage: parser, structural pass. Both errors should be recoverable
  enough to keep scanning the rest of the file.
- **Concrete proposal:** report unclosed-node at the opener line/col
  (rule a). The reviewer can flip to EOF-location if they prefer.

## Block-comment closer — E_UNCLOSED_COMMENT (no PLAN.md entry — new I.review item)

- `unclosed-comment.wit` opens `~~ ...` and never closes. Loc points
  at the opening `~~` so the fix is obvious.
- Stage: lexer. Block comments are lexer-level; line comments `~ ` do
  not need a closer and are not represented here.
- **Concrete proposal:** loc = opener (rule a).

## Paren grouping — E_UNCLOSED_PAREN (no PLAN.md entry — new I.review item)

- `unclosed-paren.wit` writes `@x(a, b` with no `)` before newline /
  next structural token. Loc points to the opening `(`.
- Stage: parser, inside the call/argument-list sub-grammar.
- **Concrete proposal:** loc = opening paren (rule a). Reviewer may
  prefer the EOF-of-arg-list position.

## Definition closer — E_UNCLOSED_DEFINITION (no PLAN.md entry — new I.review item)

- `unclosed-definition.wit` opens `#x` and reaches EOF with no `x#`.
  Same shape as E_UNCLOSED_NODE but for definitions; kept as a separate
  code so consumers can branch behaviour (e.g. definition vs node UX).
- Stage: parser, structural pass.
- **Concrete proposal:** loc = opener line/col (rule a).

## Empty-pipe sentinel — E_EMPTY_PIPE (no PLAN.md entry — new I.review item)

- `empty-pipe-in-body.wit` puts a bare `|||` line inside a node body.
  `|||` is reserved for the empty/sentinel pipe form and is not legal as
  a body element on its own — at least not in M1's surface.
- Stage: parser, body element pass.
- **Concrete proposal:** loc = the `|||` token (rule a). If we later
  decide `|||` IS a legal body element, this fixture moves to valid/
  and the code is retired.

## Unresolved reference — E_UNRESOLVED_REFERENCE (no PLAN.md entry — new I.review item)

- `bad-reference.wit` writes `@nonexistent` with no matching `@nonexistent
  ... nonexistent@` definition anywhere in the resolution scope.
- Stage: **resolver**, after parsing succeeds. The parser produces a
  reference node; the resolver discovers the target is missing.
- Loc points at the `@` of the bad reference, not the line of the
  enclosing node.
- **Concrete proposal:** loc = reference site, not definition site
  (rule a) — the definition does not exist, so there is no definition
  site to point at.

## Missing field on resolved node — E_MISSING_FIELD (no PLAN.md entry — new I.review item)

- `missing-field.wit` defines `@x` with a `value` field, then writes
  `@x.nonexistent` elsewhere. The reference resolves to `@x` but the
  field `nonexistent` is absent.
- Stage: **resolver**, field-lookup sub-step after reference resolution.
- Loc points to the field name, not the `@x` prefix.
- **Concrete proposal:** loc = field name (rule a). Reviewer may prefer
  loc = the dot, but the field name is what the author needs to fix.

## Missing referenced file — E_MISSING_REFERENCE_FILE (no PLAN.md entry — new I.review item)

- `missing-reference-file.wit` opens with `reference ./nonexistent.wit`.
  The resolver tries to load the file and fails.
- Stage: **resolver**, file-loading sub-step (the earliest resolver step;
  fires before any reference / field lookup).
- Loc points to the `reference` directive line.
- **Concrete proposal:** loc = the `reference` keyword (rule a). This is
  distinct from E_UNRESOLVED_REFERENCE so tooling can suggest a path fix
  rather than a name fix.

## Circular reference — E_CIRCULAR_REFERENCE (no PLAN.md entry — new I.review item)

- `circular-reference.wit` references `circular-reference/a.wit`, which
  references `b.wit`, which references back to `a.wit`. Three-file cycle
  to keep it obvious; a two-file or self-cycle would also trigger this
  code.
- Stage: **resolver**, reference-graph pass after each file parses but
  before semantic resolution.
- Loc points at the entry `reference` directive that first observed
  the cycle. Multi-file cycles may want a list of participants in the
  full diagnostic, but `loc` keeps the single best caret.
- **Concrete proposal:** loc = the `reference` directive whose load
  closed the cycle (rule a). Reviewer can switch to "first file in
  cycle" if they prefer deterministic-by-name reporting.

## Partial shape mismatch across additive files — E_PARTIAL_SHAPE_MISMATCH (no PLAN.md entry — new I.review item)

- `mismatched-shape-additive.wit` and its companion
  `mismatched-shape-additive/extra.wit` both define `@thing` with
  conflicting field types (`kind` is `"widget"` in one and `42` in the
  other) and disjoint fields (`count` vs `colour`). Under additive
  composition the shapes cannot merge.
- Stage: **resolver**, shape-merge sub-step.
- Loc points at the conflicting field in the *second* contributor — the
  one that introduced the contradiction relative to the first parsed
  file. Order-sensitive caret is fine here; the full message should
  cite both sites.
- **Concrete proposal:** loc = conflicting field in the later file
  (rule a). Reviewer may prefer reporting at the original definition.

## Bare word after comma in record value — E_BARE_FIELD (no PLAN.md entry — new I.review item)

- `comma-in-record-value-bare-word.wit` writes
  `{ msg - hello, world }`. The token `world` after the comma is a
  bare word with no field name, which the record grammar rejects.
- Stage: parser, record sub-grammar.
- Loc points at the bare token.
- **Concrete proposal:** loc = the bare token (rule a). Reviewer may
  prefer the comma instead.

## Strict-typed equality mismatch — E_TYPE_MISMATCH (no PLAN.md entry — new I.review item)

- `mixed-types-impossible.wit` compares `@x.value` (an integer `1`)
  against `"true"` (a string) inside an `(if ... is ...)` expression.
  Under strict typing the comparison is statically impossible.
- Stage: **resolver / type-checker**, after field resolution. Listed
  with the resolver-stage codes because it depends on the type of
  `@x.value` being known.
- Loc points at the literal on the right-hand side of `is`.
- **Concrete proposal:** loc = the offending literal (rule a). Reviewer
  may prefer the `is` keyword for a centred caret.

## Convention recap for this category

- One fixture = one error code path. If a future fixture needs to
  exercise two codes interacting, it belongs in `17-combinations/`
  (or a future `tests/errors-combinations/`), not here.
- Sidecars stay tiny. `message_contains` is a lowercase substring; the
  parser may render any prose around it.
- `loc` always points at the most-useful caret for a human fix, not
  necessarily the technically-earliest scanner position.
- Codes are stable identifiers per DS-15 and do not get renamed without
  a migration entry.
