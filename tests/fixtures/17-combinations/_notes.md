# 17-combinations fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: small, realistic-but-minimal documents that exercise 3–5
already-declared features at once. M1.17 does NOT introduce new
syntax; every token used here is part of a category between 00 and
16. The point is to probe whether features compose without
unexpected interactions, and to flag cross-cuts where two
single-feature proposals collide or leave a seam.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line; all explanatory text lives in this file.

Fixture inventory and combined surfaces:

- `record-iteration-conditional.wit` — records (DS-9) + iteration
  (DS-12) + access (DS-11) + conditionals (DS-13).
- `definition-with-captures-and-data.wit` — definition + captures
  + interpolation (DS-6) + record data + access (DS-11) feeding
  pipe params (DS-5).
- `nested-nodes-with-params.wit` — nested block-form nodes
  (DS-4) + pipe params (DS-5) + use-side `!!` short-close on the
  innermost node (DS-6 I.17 surface).
- `partial-with-reference.wit` — `reference` (DS-8) +
  `+#bibliography:` additive partial (DS-7) coexisting in one
  master file.
- `access-in-param.wit` — record data + access path as a pipe
  param value: `|src @config.lamp_path|` (DS-5 × DS-11).
- `access-in-condition.wit` — access path inside an `(if ... is
  ...)` comparison (DS-13 × DS-11).
- `script-injects-rendered-content.wit` — `<% %>` script (DS-15)
  with `lh.inject` dropping a Wit-syntax fragment into a node
  body that lives inside another node body (DS-15 × DS-4).
- `def-of-def.wit` — a definition whose body references another
  definition (DS-6 intra-category nest; pins 07-definitions's
  in-file scope proposal).
- `multi-file-with-iteration/master.wit` (+ `hands.wit`) —
  `reference` (DS-8) + `(each)` (DS-12) iterating a collection
  declared in the referenced file (DS-9 / DS-10).
- `emphasis-inside-node-body.wit` — block-form node body (DS-4)
  containing italic `_..._` and bold `*...*` (DS-2).

## Records + iteration + conditional + access (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-9, DS-10, DS-11, DS-12, DS-13.
Fixture: `record-iteration-conditional.wit`.

- The four-way combination has each individual feature already
  pinned by its single-feature category:
    - DS-12 (iteration): `(each @c as item) ... (end)` with
      loop-variable scope = body-only, lexical shadowing.
    - DS-13 (conditional): `(if ... is ...) ... (end)` with
      `(end)` LIFO untyped.
    - DS-11 (access): `@item.field` tight, no whitespace.
    - DS-9 / DS-10 (records / collections): collection of records
      in source order.
- The combination raises one composition question not pinned by
  any single category:
  (a) `(end)` inside `(each ...)` always closes the innermost
      open block (LIFO untyped), regardless of whether the
      innermost is `(each)` or `(if)`. Two consecutive `(end)`
      then close the `(if)` first, then the `(each)`.
  (b) `(end)` must match the innermost SAME-KIND open construct
      (typed-by-position): inner `(if)`'s `(end)` cannot close
      an outer `(each)`.
  (c) Typed `(end if)` / `(end each)` required when mixing kinds.
- **Concrete proposal:** (a). Carries forward 13-iteration's
  LIFO-untyped lean. The fixture's two trailing `(end) (end)`
  close inner `(if)` then outer `(each)`. Not committed; surface
  at M1.review as a confirmation of the cross-cut.

## Access path inside pipe param value (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5 / 5.S.*, DS-11.
Fixture: `access-in-param.wit`.

- 06-parameters-pipes pins `|key value|` as the named-pipe shape:
  everything after the key word up to the closing `|` is the
  value, taken as bytes. 11-data-access pins `@name.field` as
  an access reference that resolves to a scalar value at expand
  time. The combination `|src @config.lamp_path|` puts an access
  reference inside a pipe value.
- Three candidate rules:
  (a) **Pipe values are byte-literal; `@config.lamp_path` is
      literal text.** Under (a), the rendered `src` attribute is
      the string `@config.lamp_path`, which is almost certainly
      not what the author meant.
  (b) **Pipe values are scanned for interpolatable references**
      (`@name`, `@name.field`, `::name::` inside a definition
      body). Under (b), `@config.lamp_path` resolves to
      `/lights/fresnel-12.png` before the value is passed.
  (c) **Pipe values are byte-literal unless prefixed by a sigil**
      (e.g. `|src $@config.lamp_path|`). Under (c), the author
      opts in to interpolation; the bare `@...` is literal.
- **Concrete proposal:** (b). Authors expect a pipe value to
  behave like prose — references resolve, literals pass
  through. (a) makes records + access useless in any
  param-driven node, which is the dominant use case in the
  example corpus. (c) introduces new syntax (a sigil) and is
  out of scope for M1.17. Not committed; surface at M1.review.
- Open under proposal (b): does fuzzy-matching (camelCase /
  snake_case / spaces — 11-data-access fuzzy-match-* fixtures)
  apply inside pipe values? Lean: yes, same access machinery
  end-to-end. Not probed separately.

## Access path inside conditional comparison (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-11, DS-13.
Fixture: `access-in-condition.wit`.

- 12-conditionals pins `(if @ref is value)` and `(if @ref is
  @other)` as the comparison shapes. 11-data-access pins
  `@name.field` as an access reference. The combination puts an
  access reference on the left of `is`. Spec-wise this should
  Just Work, but pins one cross-cut: how is the right-hand side
  `draft` lexed?
- Three candidate rules for the RHS bare token:
  (a) **Bare RHS is a string literal** — `draft` is the literal
      string `"draft"`, compared by string equality against the
      resolved access value.
  (b) **Bare RHS is a reference if it matches a defined name,
      else a string literal** — resolver-dependent classification.
      Surprising; coupling parse to resolve.
  (c) **Bare RHS is always a reference; string literals require
      quoting** — would force `(if @book.status is "draft")`,
      adding new syntax (quotes).
- **Concrete proposal:** (a). Matches the
  `compare-against-string.wit` / `is-comparison.wit` fixtures in
  12-conditionals (both rely on a bare RHS being literal). Not
  committed; surface at M1.review.

## Definition + captures + record-fed pipe values (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, DS-6, DS-9, DS-11.
Fixture: `definition-with-captures-and-data.wit`.

- Combines: `#cite` with `||author, work||` captures and
  `::author:: ::work::` interpolation (DS-6); a `#weil` record
  (DS-9); access into that record via `@weil.author` and
  `@weil.work` (DS-11); pipe params on `@cite` carrying those
  access values (DS-5).
- The composition question riding on top of the
  "access in pipe value" proposal above: at what stage is the
  access resolved relative to capture binding?
  (a) **Access resolves first, then capture binds the resolved
      value.** Under (a), `::author::` expands to
      `Simone Weil` — capture sees a scalar string.
  (b) **Capture binds the access reference itself; resolution
      happens at interpolation site.** Under (b), `::author::`
      triggers another resolve. Identical surface output but
      different evaluation order; matters if either step has
      side effects (none today) or if captures are passed to
      other definitions.
- **Concrete proposal:** (a). Pipe values are evaluated at the
  use-site of the definition; captures bind to evaluated
  scalars. Simpler model; matches the eager-evaluation reading
  of the example corpus. Not committed; surface at M1.review.

## Use-side `!!` short-close inside nested block-form nodes (PLAN.md I.17)

Cross-refs: PLAN.md DS-4, DS-5, DS-6 (I.17),
05-nodes-parens/_notes.md, 07-definitions/_notes.md (I.17
downstream).
Fixture: `nested-nodes-with-params.wit`.

- 07-definitions' I.17 section already flagged the use-side
  `!!` close as DEFERRED with a lean toward (a) "`!!` is
  definition-only." This fixture surfaces the same question on
  a nested use-side: `@em the lens kept its vigil !!` nested
  inside `@aside ... aside@` nested inside `@chapter ...
  chapter@`. If `!!` is definition-only, this fixture is an
  error or `!!` is literal bangs in body text.
- Three candidate rules (echoing 07-definitions I.17):
  (a) **`!!` is definition-only.** `@em ... !!` is malformed;
      either the inner `@em` lacks a `em@` closer (parse error),
      or `!!` is two literal bang bytes inside the `@em` body
      (which itself is then unclosed). Under (a), this fixture
      is an explicit FAILURE probe — included to pin that the
      parse error is at the missing `em@`, not at `!!`.
  (b) **`!!` is dual-role** — closes definition values OR
      use-side block-form bodies that have no `name@`. Under
      (b), the fixture is well-formed and the `@em` body
      terminates at `!!`.
  (c) **`!!` is a generic short-close** — closes the nearest
      open construct of any kind.
- **Concrete proposal:** (b). The combination here is exactly
  the case that motivates a use-side short-close — deeply
  nested block-form nodes accumulate `name@` closers that
  clutter the prose. `!!` as a use-side short-close keeps the
  inner-most invocation compact while preserving `name@` for
  outer nesting. This DEVIATES from 07-definitions' lean of
  (a); flagging the conflict for M1.review. The cross-cut is
  significant — `!!` semantics need a single ruling across DS-6
  and DS-4. Not committed; surface at M1.review.

## `reference` and `+#partial` in the same file (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7, DS-8,
08-additive-partials/_notes.md (merge semantics),
14-composition/_notes.md (reference graph).
Fixture: `partial-with-reference.wit`.

- 14-composition pins `reference` resolution and DS-7 / 08
  pins `+#name` merge across files. The combination probes
  whether the master file (which both pulls in `./shared.wit`
  AND declares its own `+#bibliography:` contribution) merges
  its own contribution into the shared-name pool.
- Three candidate rules:
  (a) **All `+#name` contributions in the reference graph
      merge regardless of which file declares them.** The
      master file's own `+#bibliography:` is one more
      contribution in the merged body. Under (a), the order
      rule (08-additive-partials lean: source order across the
      whole reference graph, topological by reference depth) is
      what determines whether the master's contribution comes
      before or after `shared.wit`'s.
  (b) **`+#name` contributions are file-local; master's
      `+#bibliography:` is a separate definition from any
      contributions in `shared.wit`.** Under (b), this fixture
      either errors (name collision) or the master's
      contribution shadows the shared one.
  (c) **`+#name` requires the `#name` head to be declared
      somewhere in the graph; bare `+#name` everywhere with no
      head is an error.** Under (c), this fixture is an error
      because no file declares `#bibliography` (without the `+`).
- **Concrete proposal:** (a). Matches 08-additive-partials's
  "global within reference graph" lean and 07-definitions's
  scope proposal (b). The master's own `+#bibliography:`
  merges in source-order at its position; `shared.wit`'s
  contributions merge in at the position where the
  `reference ./shared.wit` directive sits. Not committed;
  surface at M1.review.
- Note: `shared.wit` is intentionally NOT authored in this
  fixture. The fixture probes the SYNTACTIC combination
  (reference directive + `+#partial` declaration coexisting in
  one file). The resolver-side missing-file behavior is
  covered by `14-composition/missing-file/`; not duplicated
  here.

## Script `lh.inject` of Wit fragment into nested node body (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, DS-15,
15-scripting/_notes.md (lh.inject surface).
Fixture: `script-injects-rendered-content.wit`.

- 15-scripting's `lh-inject-into-node.wit` pins
  `lh.inject('name', fragment)` as the script-side surface for
  contributing content to a node by name. This fixture
  combines that with DS-4 nesting: the injection target
  `@inset` is invoked INSIDE another block-form node
  (`@chapter`). Additionally, the injected fragment string
  itself contains Wit syntax (`@em the lamp ... !!`).
- Three candidate rules for the injected fragment:
  (a) **Injected fragments are re-parsed as Wit.** The
      fragment's bytes are tokenized and parsed in the same
      pipeline; `@em` becomes a node invocation; `!!` resolves
      under whatever I.17 settles on. Under (a), the script can
      synthesize arbitrary Wit AST.
  (b) **Injected fragments are byte-literal text.** Under (b),
      the rendered `@inset` body is the literal string
      `@em the lamp had burned untended !!` — no further
      parsing.
  (c) **Injected fragments are byte-literal by default; opt-in
      via a `lh.injectRaw` / `lh.injectMarkup` distinction.**
- **Concrete proposal:** (a). The example corpus's scripting
  usage (`examples/19-scripting/`) treats injected content as
  Wit-syntax fragments; the whole point of `lh.inject` is to
  let scripts produce structured content, not opaque strings.
  Cross-cuts I.17 because the fragment uses `!!` as a
  use-side short-close — same ruling needed across DS-15 and
  DS-4. Not committed; surface at M1.review.

## Definition body referencing another definition (PLAN.md I.9)

Cross-refs: PLAN.md DS-6, I.8 / I.9,
07-definitions/_notes.md (definition scope; forward refs).
Fixture: `def-of-def.wit`.

- 07-definitions already has
  `definition-references-definition.wit` which probes the same
  in-file shape. This fixture is the minimum-viable variant
  and is included for completeness of the combinations matrix
  (definition + use-side reference to another definition). The
  proposal from 07-definitions stands: rule (c) of I.8 — parser
  emits unresolved `@x` and `#x`; resolver binds across the
  whole reachable graph; authors see hoisted, globally-scoped
  definitions.
- The combination question this fixture adds on top of the
  single-feature proposal: at expansion of `@signature`, the
  body's `@keeper` is resolved at the EXPANSION site
  (signature's body expansion) or at the DEFINITION site
  (where `#signature` was declared)?
  (a) **Resolved at expansion.** Each `@signature` expansion
      re-resolves `@keeper` against the then-current resolver
      state. Matters once additive partials and scripts can
      mutate definitions between expansions.
  (b) **Resolved at definition / capture-time.** The body's
      `@keeper` is bound when `#signature` is first seen; later
      mutations of `#keeper` do not affect existing
      `@signature` expansions.
- **Concrete proposal:** (a). Matches the C-section pipeline
  where definitions are not "captured" until expansion; also
  matches the additive-merge model where the final `#keeper`
  body is whatever the resolver assembled after all `+#keeper`
  contributions are gathered. Not committed; surface at
  M1.review.

## Cross-file collection consumed by `(each)` (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-8 / DS-9 / DS-10 / DS-12,
08-additive-partials/_notes.md, 14-composition/_notes.md.
Fixture: `multi-file-with-iteration/master.wit` (+ `hands.wit`).

- `master.wit` uses `reference ./hands.wit` and then iterates
  `@hands` (declared in `hands.wit`). All four single-feature
  proposals (DS-8 reference resolution, DS-9 records, DS-10
  collections, DS-12 each-loop) already commit to behaviors
  that compose cleanly here. The combination question is the
  resolution timing of `@hands` on the iteration head.
  (a) **`@hands` resolves as a collection reference; the
      iteration head holds the resolved sequence in source
      order; loop body executes once per item.** Same as
      single-file iteration, just resolved across files.
  (b) **Cross-file references trigger re-resolution per
      iteration; mutation of the referenced collection between
      iterations is visible.** Would couple iteration to
      reference-graph mutation; far more expensive.
- **Concrete proposal:** (a). The resolved sequence is fixed at
  the iteration head; body iterations see a stable snapshot.
  Cross-cuts the "resolved at expansion" lean from `def-of-def`
  above — definitions resolve at expansion, but iterated
  COLLECTIONS are snapshotted at iteration entry. Two-line
  distinction worth flagging. Not committed; surface at
  M1.review.

## Emphasis inside a block-form node body (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-2, DS-4,
02-emphasis/_notes.md, 04-nodes-use/_notes.md.
Fixture: `emphasis-inside-node-body.wit`.

- 02-emphasis pins `_italic_` / `*bold*` as inline marks that
  wrap a single token. 04-nodes-use pins `@name ... name@` as
  the block-form invocation. The combination puts both inline
  marks inside the body bytes of an `@aside` node. The
  composition question: does the parser apply DS-2 emphasis
  tokenization inside a use-side block-form body, or are body
  bytes opaque?
- Three candidate rules:
  (a) **Body bytes parse with the full prose grammar** —
      emphasis marks, interpolation (when inside a definition
      body), node invocations, parameters, scripts, etc. all
      tokenize inside an `@name ... name@` body the same way
      they do in top-level prose.
  (b) **Body bytes parse only the structural surface** —
      child node invocations and short-closes, but no emphasis
      / no interpolation. Inline marks render literal.
  (c) **Body bytes are opaque text** — the renderer gets a
      single Text run.
- **Concrete proposal:** (a). The example corpus (`examples/`)
  routinely places emphasis inside node bodies; (c) would
  invalidate the prose registry pattern. (b) is internally
  inconsistent — child node invocations are clearly recognized
  inside bodies (every block-form fixture in 04 / 05 / 06
  shows this), so excluding only emphasis from the same
  context-free machinery is hard to justify. Not committed;
  surface at M1.review.
- Open under proposal (a): emphasis marks that STRADDLE a
  child-node boundary (`_word @x word_`) — illegal because
  emphasis wraps a token, not a span? Lean: yes, illegal /
  literal. Not probed here.

## Cross-cuts to flag at M1.review (no PLAN.md entry — new I.review item)

- **I.17 unification:** `nested-nodes-with-params.wit` and
  `script-injects-rendered-content.wit` both propose (b)
  "use-side `!!` short-close" while 07-definitions's I.17
  section leaned (a) "definition-only." A single ruling is
  needed across DS-4, DS-6, and DS-15.
- **Access-in-value uniformity:** `access-in-param.wit`,
  `access-in-condition.wit`, and
  `definition-with-captures-and-data.wit` all assume
  `@name.field` is recognized inside non-prose contexts (pipe
  values, conditional comparisons, captured values). The
  single-feature categories implied this but did not probe it
  directly; the combinations pin it.
- **Resolution timing split:** definitions resolve at
  expansion (`def-of-def`); iterated collections snapshot at
  iteration entry (`multi-file-with-iteration`); pipe values
  evaluate eagerly at use-site
  (`definition-with-captures-and-data`). Three different
  timings; the M1.review note should reconcile or codify the
  distinction.
- **`+#partial` + `reference` graph:** `partial-with-reference.wit`
  assumes contributions merge globally across the reference
  graph regardless of declaring file. 08-additive-partials's
  lean supports this; flag for confirmation.

## Authoring invocations

All fixtures authored as plain LF-terminated UTF-8 via the
editor. No byte-sensitive cases (CRLF, bare CR, BOM,
no-trailing-LF) in this category — those belong to
`00-lexical/`.
