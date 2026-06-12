# 25-content-in-captures fixtures — authoring notes

Bulleted log of decisions surfaced while writing these fixtures.
No surprises here — surface at review.

Scope: M17.block-aware-capture-substitution. A captured raw-string
value (form-fill body, record field, pipe-form value) is re-parsed
at substitution / data-access time using the FULL parser, not just
`parseInlineFromText`. Block-level constructs in the captured text
(`@h1 ... h1@`, lists, tables, paragraph breaks) now produce real
block nodes in the expanded output instead of leaking through as
literal text.

Narration discipline: per `tests/fixtures/README.md`, narration is
forbidden from `03-comments/` onward. Every fixture in this directory
was authored with NO narration line.

## Splicing rules implemented

- Substitution at a block position (a NodeUse on its own line, an
  Interpolation that is the only child of its containing Paragraph,
  or any captured value containing block constructs): all blocks
  from the re-parse splice in at the block-level position; the
  enclosing Paragraph (if any) is split around them.
- Substitution at an inline position (mid-paragraph): if the value
  parses to a single Paragraph, its inline children splice (preserves
  back-compat with the pre-M17 behaviour). If the value parses to
  multiple blocks or a non-paragraph block, the enclosing Paragraph
  lifts into a block sequence — runs of inlines re-wrap into
  Paragraphs, blocks emit on their own.
- Substitution inside emphasis (`_x_` / `*x*` children): block-shaped
  items from the re-parse are dropped — emphasis cannot contain block
  content. Only inline content from the first parsed paragraph is
  taken.
- Empty captured value → empty splice.

## Fixture inventory

- `multi-paragraph-value.wit` — a record field's value contains a
  paragraph break; accessed at block position via `@card_b.body`.
  Confirms both paragraphs survive as separate blocks.
- `value-contains-heading.wit` — value contains `@h1 ... h1@` after a
  blank line, accessed at block position. Confirms the heading
  renders as a real block (`@h1` reaches the expander as a NodeUse,
  not literal text).
- `value-contains-list.wit` — value contains a `@ul / @li / @li / ul@`
  list. Confirms list structure is preserved through the capture →
  re-parse → splice round-trip.
- `value-with-emphasis-only.wit` — value contains only inline
  emphasis (`_italic_` and `*bold*`), accessed mid-prose. Confirms
  the inline-only fast path is unchanged from pre-M17 behaviour.
- `value-at-inline-position.wit` — multi-paragraph value used at an
  inline position (mid-paragraph `@x.body`). Confirms the
  Paragraph-lifting rule for block content at inline sites.

These fixtures are parse-only — the snapshot harness records the AST
shape. The expander behaviour they target is exercised via the
integration tests (`tests/integration/`) and the M17 smoke test
(`/tmp/card-test.wit`).

## Why a new category rather than extending `22-record-args/`

The bug is not specific to record-args — it touches every capture
shape (form-fill, pipe, parens, record-arg) AND data-access via
`@x.field`. A dedicated `25-content-in-captures/` category keeps
the fixtures grouped by intent rather than by surface form.
