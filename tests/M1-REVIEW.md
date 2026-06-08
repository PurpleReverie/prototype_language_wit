# M1 design review summary

Final pass of milestone M1 (Language lock). Closes the fixture-
writing milestone and assesses readiness for M2 (Lexer + Parser
MVP). Companion to `tests/M1-RECONCILIATIONS.md` (cross-category
conflict resolutions) and `PLAN.md` section I (open design
questions, now I.1 through I.130).

---

## State of the language after M1

The M1 pass authored 226 `.wit` fixtures, 13 `.err.json` error
sidecars, and 20 `_notes.md` authoring logs across 18 fixture
categories (00-lexical through 17-combinations) plus an integration
directory and an errors directory. Together these constitute the
**executable spec** for Wit.

Major locked proposals (high level):

- **Lexical surface.** Single blank line is a paragraph boundary;
  multiple blank lines collapse to one. CR/CRLF/LF normalized
  pre-lex. UTF-8 with optional trailing LF. Comments `~ ...` (line)
  and `~~ ... ~~/` (block) are retained AST nodes, elided from
  render.
- **Prose and emphasis.** Prose is the default; markdown-ish
  leaders (`>`, `*`, `-`, `1.`) at column 0 stay prose. Emphasis
  marks `_italic_` and `*bold*` require word-boundary flanking;
  digit- or letter-flanked mark characters stay literal.
- **Nodes.** `@name ... name@` block-form, `@name(params)` self-
  closing parens-form, `@name body !!` short-close. Block vs inline
  classification is a position-based AST tag, never an author
  choice. Bare-reference `@name` ends at any non-handle byte; handle
  class is `[A-Za-z0-9_-]` with first char a letter.
- **Parameters.** Two surfaces: `(...)` self-closing parens-form
  and `|...|` pipe-form composing with a body. Both share three
  slot shapes (positional / named / flag); ` - ` separates multi-
  word keys; trailing `!` marks a flag; trailing comma tolerated.
- **Definitions.** Three shapes — block (`#name ... name#`),
  single-line (`#name: value !!`), value-block (`#name:\n ... \n!!`)
  — disambiguated at the opener byte. Capture lists `||a, b||` and
  interpolations `::name::` are context-only inside definition
  bodies. `!!` is dual-role (R2): closes innermost open `#name:`
  value OR `@name ...` use-side body, LIFO.
- **Additive partials.** `+#name` contributes a body fragment to a
  definition; resolver merges all contributions in depth-first
  reference order; shape must match across contributions; mixing
  with a single non-additive `#name` base is permitted.
- **Records and collections.** `{ key - value, ... }` and `[ a, b,
  ... ]`. Eager scalar typing: signed decimal int/float → Number,
  lowercase `true`/`false` → Bool, else String. Newlines and commas
  both terminate items in multi-line bodies. Empty containers
  legal. Brace value implies no `-` separator.
- **Data access.** `@x.y.z` with left-to-right segment resolution.
  Fuzzy-match canonical key: lowercase + split on
  whitespace/underscore/camel boundaries. Numeric segment vs named
  segment disambiguated by parent value-shape (collection→index,
  record→key). Missing field is context-sensitive (R1): falsy
  inside conditional operands, error elsewhere.
- **Conditionals.** `(if cond) body (end)` or `(if cond) then
  (else) else (end)`, with `is` and `equals` as synonymous
  value-equality operators. Strict-typed comparison (no coercion).
  Bare-reference `(if @x)` is truthy unless `Bool(false)` or
  missing.
- **Iteration.** `(each @c as item) body (end)` over collections;
  body sees `@item` lexically scoped, shadowing outer same-name
  bindings until `(end)`. Source order preserved. Iterated
  collection is snapshotted at iteration entry.
- **Composition.** `reference ./path.wit` directives form a
  flattened reference graph; cross-file forward references resolve
  via global hoisting; cycles resolved by memoization (no error).
- **Scripting.** `<% ... %>` block and inline JavaScript; opaque
  bytes terminated by first `%>` outside JS string/template/regex
  state. Strict document-order execution. Frozen `lh` bridge
  surface (`data` / `query` / `node` / `sort` / `inject` / `set` /
  `prose`) plus `lh.host.*` for app extensions.
- **Errors.** 13 stable codes (`E_UNCLOSED_NODE`,
  `E_MISMATCHED_CLOSE`, `E_UNCLOSED_COMMENT`, `E_UNCLOSED_PAREN`,
  `E_UNCLOSED_DEFINITION`, `E_EMPTY_PIPE`,
  `E_UNRESOLVED_REFERENCE`, `E_MISSING_FIELD`,
  `E_MISSING_REFERENCE_FILE`, `E_CIRCULAR_REFERENCE`,
  `E_PARTIAL_SHAPE_MISMATCH`, `E_BARE_FIELD`,
  `E_TYPE_MISMATCH`). Each error fixture carries an `.err.json`
  sidecar pinning `{ code, message_contains, loc }`.

---

## Open questions still requiring M1.review judgment

Five-to-ten items where the corpus surfaces a question but
M1.review must commit before M2 can begin parser implementation
without ambiguity:

1. **Unicode policy on handles (PLAN.md I.36).** ASCII-only, NFC-
   normalised, or UAX #31. M1 fixtures are ASCII-only; deferred
   commitment.
2. **Smart-quote substitution policy (PLAN.md I.27).** Verbatim or
   substituted at apostrophe boundaries; surfaces in
   `apostrophe-after-italic` cross-cut.
3. **Empty marks `__` / `**` disposition (PLAN.md I.25).** Literal
   text vs error vs empty-emphasis node. Three candidates pinned;
   no commitment.
4. **Records-in-params composition (PLAN.md I.79).** Legal but
   deferred to a future combinations probe. Parser must decide
   whether the param-value tokenizer switches to brace-balancing
   mode when it sees `{`.
5. **Parameter value escape / quoting (PLAN.md I.4).** Long
   outstanding; no fixture commits. M2 needs a position on whether
   embedded `,`, `|`, `!` require an escape and what the escape
   surface is.
6. **`(else if cond)` chains.** Not in PLAN.md E.1, not
   fixturised. Conditional surface as committed has no chain form;
   M1.review can either commit to "no chains, nest instead" or
   open a new I item.
7. **Boolean connectives (`and` / `or` / `not`) in conditions.**
   Not in DS-11, not fixturised. Same disposition needed as #6.
8. **Resolution-timing codification (R4).** The three stages
   (eager / expansion / snapshot) are coherent but unpinned at the
   architecture level; PLAN.md C needs the per-construct table.
9. **Comparison against reference RHS (`@x is @y`).** Not
   fixturised in 12-conditionals (only literal RHS). The
   reconciliation R1 implicitly treats this as eager-evaluated;
   needs a fixture in M2 or earlier.
10. **`@scriptCall` security and host policy (PLAN.md I.13).**
    The calling-convention proposal (positional args via parens) is
    locked, but the host-side capability surface (`lh.host.*`,
    PLAN.md I.115) is intentionally extensible. M2 may not need
    this resolved, but M5/M6 will.

These are the items where a parser implementer would currently
need to make an interpretive call without a clear precedent in the
corpus. None blocks M2's first slice (categories 00-04), but
several block the full sweep.

---

## Cross-category proposals lifted to PLAN.md

Deliverable 2 of the M1.review pass added entries **I.18 through
I.130** to PLAN.md section I — 113 new entries grouped by
originating fixture category:

- I.18–I.23: lexical / whitespace / line endings (00-lexical)
- I.24–I.27: emphasis word-boundary (02-emphasis)
- I.28–I.33: comments (03-comments)
- I.34–I.38: identifier / handle character class (04-nodes-use)
- I.39–I.44: parens parameter form (05-nodes-parens)
- I.45–I.50: pipe parameter form (06-parameters-pipes)
- I.51–I.60: definitions (07-definitions)
- I.61–I.70: additive partials (08-additive-partials)
- I.71–I.83: records and collections (09-records, 10-collections)
- I.84–I.89: data access (11-data-access)
- I.90–I.97: conditionals (12-conditionals)
- I.98–I.103: iteration (13-iteration)
- I.104–I.112: composition / references (14-composition)
- I.113–I.118: scripting (15-scripting)
- I.119–I.123: combinations / cross-cuts (17-combinations)
- I.124–I.125: error model (tests/errors)
- I.126–I.130: integration-level confirmations (tests/integration)

Cross-refs preserved to the originating `_notes.md` so any
implementer reading PLAN.md can drill down for the full
discussion.

---

## Reconciliations made

`tests/M1-RECONCILIATIONS.md` documents five conflict resolutions
(R1–R5):

- **R1: Missing-field semantics.** Context-sensitive: suppressed-
  to-falsy inside conditional operands, `E_MISSING_FIELD`
  elsewhere. Reconciles M1.11 and M1.12.
- **R2: `!!` short-close.** Dual-role with LIFO context
  disambiguation: closes innermost open `@name` use-side body OR
  `#name:` definition value. Reconciles M1.04/M1.07 with M1.17;
  deviates from M1.07's "definition-only" lean.
- **R3: `(if ::param:: is X)`.** Deferred evaluation at
  expansion site for conditionals inside definition bodies that
  reference capture interpolations. Reconciles
  integration/report.wit with M1.12.
- **R4: Resolution timing.** Codified as three named stages
  (eager / expansion / snapshot). Reconciles the three-way
  timing surface in M1.17.
- **R5: `!!` token disambiguation precedence.** Composite of R2
  and M1.06 flag-marker rules; innermost-open-construct wins,
  LIFO; falls through to literal bang bytes.

When `_notes.md` and `M1-RECONCILIATIONS.md` disagree, the
reconciliations file is canonical and M2 implements the unified
rule.

---

## Statistics

| Metric | Value |
|---|---|
| Total files under `tests/` (tracked) | 262 |
| Total `.wit` fixtures | 226 |
| Total `.err.json` error sidecars | 13 |
| Total `_notes.md` files | 20 |
| Total `_notes.md` lines (across all categories) | 5030 |
| Fixture categories (00 through 17) | 18 |
| Entries in PLAN.md section I (open design questions) | 130 |
| Original I entries (pre-M1.review) | 17 |
| Lifted in M1.review (I.18..I.130) | 113 |
| Reconciliations (R1..R5) | 5 |
| Error codes enumerated (DS-15) | 13 |

---

## Parser implementation readiness assessment — M2

**Verdict: YELLOW (proceed with categories 00–04, hold the rest
until 4 open items close).**

The language is pinned tightly enough that M2's first slice
(categories 00–04 per the milestone table) can begin
**immediately**:

- The lexical surface (00-lexical / 01-prose / 02-emphasis /
  03-comments) is locked end-to-end. Every byte-level question
  surfaced in 00-lexical has either a commitment or a documented
  lean. Word-boundary rules for `_` and `*` are pinned with the
  word-character class one M1.review judgment away (Unicode
  scope, I.36).
- Use-side nodes (04-nodes-use) are locked: handle character
  class, bare-reference boundary, access-path syntax, block-vs-
  inline classification, empty body, nested-same-name LIFO.
- The error model (DS-15 / 13 codes) is enumerated with stable
  identifiers, loc conventions, and one fixture per code.

The four open items that gate the full sweep:

1. **Unicode policy on handles (I.36).** Locks the lexer's
   identifier scanner. M2 can begin with ASCII-only and migrate
   later, but a commitment here is cheap and removes a future
   breaking-change risk.
2. **`!!` token disambiguation (R2/R5).** The reconciliation is
   committed, but the lexer state machine that implements it
   has not been sketched. This is more a "specify the
   implementation" gap than an open design question.
3. **Parameter value escape / quoting (I.4).** Affects 05-nodes-
   parens, 06-parameters-pipes, 09-records, 10-collections, and
   the integration corpus. M2 can defer if no test fixture
   requires it, but a position is needed before M3.
4. **Resolution-timing codification (R4).** The three stages are
   defined in M1-RECONCILIATIONS, but PLAN.md C
   (architecture) needs the per-construct table promoted into
   the design doc, not just the reconciliation memo. M3 reads
   the table to validate the resolver/expander split.

None of the four is a "critical blocker" — each has a documented
lean and at least one fixture pinning the surface. They are
"M1.review must commit before M3" rather than "M2 cannot start."

Categories where M2 can begin safely on day one (verdict GREEN at
the category level):

- 00-lexical, 01-prose, 02-emphasis, 03-comments
- 04-nodes-use, 05-nodes-parens, 06-parameters-pipes
- 07-definitions, 08-additive-partials
- 09-records, 10-collections
- 11-data-access
- 12-conditionals, 13-iteration
- 14-composition
- 16-ambiguity (cross-cut probes ratifying earlier leans)
- tests/errors (one fixture per error code)

Categories where M2 should hold until the open items close
(verdict YELLOW):

- 15-scripting: `lh` surface and `<% %>` opacity are locked, but
  the bridge implementation is M4 territory; the lexer for
  `<% %>` can begin without commitments.
- 17-combinations: the cross-cut fixtures depend on the
  reconciliations (R1, R2, R3, R4) being implemented as written.
  M2 may parse these fixtures but must defer expected-output
  validation until the expander lands.
- tests/integration: end-to-end documents that depend on every
  category. M2 first-slice parses sections; full document parses
  belong to M3.

The headline summary: **M1 is complete. M2 can begin. M1.review
should pick up the four open items (Unicode, `!!` state machine
spec, parameter quoting, timing table) as a follow-on review pass
so M3 inherits a clean spec.**

---

## What M1 produced (artifact summary)

- 226 `.wit` fixture files across 18 categories, integration, and
  errors.
- 13 `.err.json` error sidecars pinning code + loc + diagnostic
  substring per error path.
- 20 `_notes.md` authoring logs totalling 5030 lines, recording
  every concrete proposal and surfaced ambiguity.
- `PLAN.md` section I expanded from 17 entries to 130, lifting the
  category-level proposals into the canonical open-design-question
  register.
- `tests/M1-RECONCILIATIONS.md` resolving five cross-category
  conflicts with unified rules.
- `tests/M1-REVIEW.md` (this file) summarizing state and assessing
  readiness for M2.

The corpus is the executable spec. M2 reads the fixtures, writes a
parser, and snapshot-tests against the fixture set. Every locked
proposal in PLAN.md / `_notes.md` is enforceable by the test
suite; every reconciliation in M1-RECONCILIATIONS.md is implementable
as part of the parser/resolver/expander pipeline described in
PLAN.md section C.
