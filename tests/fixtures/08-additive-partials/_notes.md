# 08-additive-partials fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the additive-partial prefix `+#name` (DS-7). A `+#name`
declaration creates or contributes to a definition whose body is
the ordered concatenation of every `+#name` contribution found in
the reference graph. The use-side surface (`@name`) is unchanged
from 04/05/06; expansion happens after the resolver has gathered
all `+#name` contributions and merged them. Spec page 8 / example
files `examples/16-additive-partials/`:

- Prefix-only marker: `+` immediately preceding `#name` (no space)
  marks the definition as additive. Same opener byte set as DS-6
  otherwise — block (`+#name ... name#`), single-line
  (`+#name: value !!`), value-block (`+#name:\n ... \n!!`).
- M1.07 carry-over context already pinned:
  - definition shape decided by opener byte (block / single-line
    / value-block) — `+` does not change the shape decision;
  - definitions are hoisted (forward-ref-safe) and globally scoped
    within a reference graph;
  - `||a, b||` capture-list, `::name::` interpolation, `!!`
    terminator, `...` body slot all remain context-only.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

Fixture inventory:

- `simple-additive-prefix.wit` — single `+#name: ... !!`, the
  smallest additive case (one contribution).
- `block-additive.wit` — `+#name ... name#` block-shape
  contribution.
- `single-line-additive.wit` — `+#name: value !!` single-line
  shape.
- `multiple-additive-same-file.wit` — three `+#bibliography`
  contributions in one file.
- `cross-file-merge/` — master.wit + one.wit + two.wit, each
  chapter contributing one `+#bibliography` entry; master uses
  `@bibliography` without ever declaring `#bibliography`.
- `mix-normal-and-additive.wit` — a `#bibliography:` declaration
  alongside a `+#bibliography:` declaration for the same name.
- `order-preservation.wit` — three `+#bibliography`
  contributions at different positions in one file, separated
  by prose, to pin the order rule.
- `mixed-body-shape.wit` — a block-shape `+#bibliography`
  plus a single-line-shape `+#bibliography` in the same file
  (different shapes, same name).
- `additive-with-captures.wit` — `+#bibliography ||author, work||`
  declaring captures on an additive contribution.

## Merge semantics for `+#name` (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7, 7.U.1, 7.S.1, 7.C.1,
`examples/16-additive-partials/`, 07-definitions/_notes.md
(forward-references / hoisting, definition scope). DS-7 / 7.C.1
anchor the merge wording but the proposed merge-stage rule
itself is unstated and surfaces here as a new I.review item.

- DS-7 / 7.C.1 wording: "Multiple `+#bibliography` declarations
  ... merge into single AST node after resolution." The merge
  happens at resolver / expander time, not at parse time. Probed
  structurally by `multiple-additive-same-file.wit` (intra-file)
  and `cross-file-merge/` (inter-file).
- Three candidate rules:
  (a) **expand-time merge** — the parser emits each `+#name`
      contribution as its own `NodeDef { additive: true, ... }`;
      the resolver collects every additive contribution with the
      same name across the reference graph and synthesises a
      single merged definition whose body is the ordered
      concatenation of contributing bodies. Parse-time stays
      simple; merge logic lives in one place.
  (b) **parse-time merge** — the parser maintains a symbol table
      and, on encountering a second `+#name`, appends to the
      existing node in-place. Couples parse with cross-file
      coordination (impossible for file-local parsers) and breaks
      the M1.07 forward-reference proposal which already pushed
      symbol resolution into a later stage.
  (c) **render-time merge** — the AST keeps every `+#name` as a
      separate definition and the renderer concatenates at output
      time. Forces renderers to re-implement the merge rule and
      defeats the "single AST node" assertion in 7.C.1.
- **Concrete proposal:** rule (a). Parity with the M1.07
  forward-reference proposal (rule (c) there — resolver does the
  lookup). The parser stays single-file and emits flat
  contributions; the resolver, which already walks the reference
  graph for `@x` lookup, performs the merge at the same pass.
  Renderer sees a single `NodeDef` with concatenated body —
  matches 7.C.1's "single AST node after resolution." Not
  committed; surface at M1.review.
- Open under proposal (a): does the merged `NodeDef.loc` point to
  the first contribution, the last, or a synthetic "merged"
  location? I.14 ("Source locations across additive partials —
  file-tagged child nodes?") covers the related question for
  child nodes; the parent node's `loc` is unprobed. Lean: first
  contribution's `loc`, with child nodes carrying their own per-
  contribution `loc`. Not probed in this category.
- Open under proposal (a): merge identity. Names compare on raw
  bytes (case-sensitive, exact match). `+#Bibliography` and
  `+#bibliography` are two different definitions, not a merge.
  Parity with the rest of the language's case-sensitive handle
  rule. Not probed.

## Mix normal `#x` with additive `+#x` (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7, 7.C.1, 7.C.3,
`mix-normal-and-additive.wit`, 07-definitions/_notes.md
(definition redefinition — flagged as M1.08 territory).
DS-7 / 7.C.1 cover additive merge in the abstract; the
composition with a non-additive `#name` base is not pinned
in PLAN.md and surfaces here as a new I.review item.

- 07-definitions/_notes.md flagged this exact composition under
  "Open under proposal (c)" of the hoisting section: "definition
  redefinition — two `#x:` blocks in one file. Error, last-one-
  wins, or merge? Lean: error unless the second carries the `+#x`
  additive prefix (DS-7 / M1.08 territory)." This category pins
  it.
- Probed by `mix-normal-and-additive.wit`: one `#bibliography:`
  declaration plus one `+#bibliography:` declaration in the same
  file, both single-line shape.
- Three candidate rules:
  (a) **base + additives compose** — a single non-additive
      `#name` declaration acts as the "base"; subsequent `+#name`
      contributions append to the base body. Multiple non-
      additive `#name` declarations remain an error. Under (a),
      `mix-normal-and-additive.wit` resolves to a `NodeDef` whose
      body is the base's bytes followed by the additive's bytes.
  (b) **strict separation** — `#name` and `+#name` for the same
      name is always an error; the author must choose one mode.
      Removes a class of subtle bugs (which body wins on
      conflict?) but rejects an arguably useful pattern (an
      author declares a starter bibliography in master.wit and
      chapters add to it).
  (c) **last-non-additive wins, additives append** — same as (a)
      but tolerates multiple non-additive `#name` by taking the
      last as the base. Mixes redefinition-as-override with
      additive composition; loses the M1.07 "definition
      redefinition is an error" lean.
- **Concrete proposal:** rule (a). Preserves the M1.07 "two
  `#x:` is an error" rule while still permitting the master-
  declares-skeleton + chapters-contribute-entries pattern from
  `examples/16-additive-partials/`. The base counts as
  contribution zero in document/reference order; additives
  follow. Not committed; surface at M1.review.
- Open under proposal (a): what if the base is declared in file
  B but additives appear in file A, and file A loads before
  file B in the reference traversal? Lean: the resolver gathers
  all contributions first, then orders them — base always sorts
  first regardless of traversal order. Alternative: pure
  document/reference order with no special treatment for the
  base. Not probed (the cross-file fixture has no base).

## Shape compatibility across contributions (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7, 7.C.3, 6.S.4 (definition shapes),
`mixed-body-shape.wit`, 07-definitions/_notes.md
(definition shape classification). 7.C.3 anchors the
"structural bodies refuse merge" wording; the specific
shape-compatibility rule across `+#name` contributions is not
spelled out in PLAN.md and surfaces here as a new I.review
item.

- 7.C.3 wording: "Partial with non-mergeable body errors —
  structural bodies refuse merge." Read literally, "structural
  bodies" reads like records / collections (M1.09 territory).
  In M1.08, the closest analog is two `+#name` contributions
  with incompatible definition shapes (block vs single-line vs
  value-block). Probed by `mixed-body-shape.wit`: a
  `+#bibliography ... bibliography#` block-shape followed by a
  `+#bibliography: ... !!` single-line-shape.
- Three candidate rules:
  (a) **shape must match across contributions** — all `+#name`
      contributions must share the same definition shape. Mixing
      block with single-line is an error at parse/resolver time.
      The merged body type is determined by the contributions'
      common shape.
  (b) **shapes coerce to block** — the merger treats all
      contributions as block-shape body sequences regardless of
      their declared shape. A single-line `+#x: foo !!` becomes
      a one-item body of `foo`; a block `+#x ... x#` contributes
      its inner body bytes. The merged definition is always
      block-shape.
  (c) **shape-free merge** — the merger concatenates raw body
      bytes regardless of shape; the result re-parses as
      whatever the bytes naturally form. Maximum permissiveness;
      surprising round-trip behavior (single-line + single-line
      yields `value !! value !!`).
- **Concrete proposal:** rule (a). 7.C.3's wording —
  "structural bodies refuse merge" — reads most directly as
  "shapes that disagree on structure do not merge"; treating
  shape mismatch as a parse/resolver error is the closest M1.08
  analog of that conformance row. Under (a),
  `mixed-body-shape.wit` is an ERROR fixture: the block-shape
  `+#bibliography ... bibliography#` and the single-line-shape
  `+#bibliography: ... !!` cannot merge and the resolver
  rejects the combination. Ergonomic loss is real — chapter
  authors must agree on a shape across the reference graph, or
  the master must pin shape via a non-additive base — but this
  follows the conformance row rather than working around it.
  Rule (b) is more permissive but invents coercion semantics
  PLAN.md does not authorise; rule (c) loses the per-
  contribution boundary entirely. Under (a) the merged
  `NodeDef.shape` is the shared shape of all contributions; per-
  contribution `loc` records remain. Not committed; surface at
  M1.review.
- Open under proposal (a): does a `value-block` contribution
  count as the same shape as a `block` contribution for merge
  purposes, or are all three shapes (block / single-line /
  value-block) mutually exclusive? Lean: mutually exclusive —
  the M1.07 lean classified them as three distinct shapes by
  opener byte, and merge should follow that classification.
  Not probed (no value-block + block fixture).
- Open under proposal (a): mixed captures across contributions
  with different shapes — moot under (a) since mismatched
  shapes do not merge; see "Captures on `+#x`" for the same-
  shape case.

## Order preservation (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7, 7.C.4, DS-8 (reference graph),
`order-preservation.wit`, `cross-file-merge/`,
`multiple-additive-same-file.wit`. DS-7 / 7.C.4 anchor the
"document/reference order" wording; the specific traversal
rule (depth-first vs breadth-first vs flat-declaration) is not
pinned in PLAN.md and surfaces here as a new I.review item.

- 7.C.4 wording: "Partial ordering — children appear in
  document/reference order." Probed in three layers:
  - intra-file order via `order-preservation.wit` (three
    `+#bibliography` contributions interleaved with prose);
  - inter-file order via `cross-file-merge/` (master.wit lists
    `reference ./one.wit` before `reference ./two.wit`; the
    merged body should order `one.wit`'s contributions before
    `two.wit`'s);
  - mixed intra+inter via the example
    `examples/16-additive-partials/chapters/*.wit` corpus (not
    a fixture, but anchors the lean).
- Three candidate rules:
  (a) **document order, depth-first reference traversal** —
      contributions sort by `(traversal-index-of-file,
      byte-offset-in-file)`. The reference graph is walked depth-
      first from the entry file; within a file, contributions
      appear in source-byte order. Under (a), master.wit's own
      `+#name` contributions (if any) precede contributions
      from referenced files in the order their `reference`
      directives appear.
  (b) **reference order, breadth-first** — files are visited
      breadth-first from the entry; contributions within a file
      stay in byte order. Differs from (a) when the graph has
      depth > 1. The fixture corpus does not probe depth > 1
      cross-file.
  (c) **declaration order, flat** — every contribution is
      timestamped at parse time across the entire corpus; the
      merged body sorts by that timestamp. Equivalent to (a)
      when the parser is single-threaded and walks files in
      reference order.
- **Concrete proposal:** rule (a). Depth-first reference
  traversal is the simplest mental model for an author ("my
  references load in the order I list them; within a file,
  things happen in the order I wrote them"). Matches DS-8's
  reference-graph model (W7.1) and 7.C.4's plain wording.
  Breadth-first (b) is unusual for textual document assembly;
  flat declaration order (c) leaks parser implementation. Not
  committed; surface at M1.review.
- Open under proposal (a): what about a `+#name` declared
  inside another definition's body (nested)? Lean: nesting
  inside another definition is out of scope for M1.08 (deferred
  with the broader nested-definitions question from M1.07);
  treating the inner `+#name` as a sibling of the enclosing
  definition is the simplest answer if it ever lands. Not
  probed.
- Open under proposal (a): two `reference ./x.wit` lines for
  the same file in the same master — do `+#name` contributions
  in `x.wit` appear twice? Lean: reference de-duplication
  (`x.wit` loads once, contributes once). DS-8 territory; not
  probed here.

## Cross-file scope for `+#name` (PLAN.md I.9 / DS-7 / 7.C.2)

Cross-refs: PLAN.md I.9, DS-7, 7.C.2, DS-8,
`cross-file-merge/`, 07-definitions/_notes.md (definition scope).

- I.9 / M1.07's _notes.md leaned "global within ref graph" for
  definitions generally. `+#name` is the case that makes that
  lean operational: the whole point of additive partials is that
  contributions from different files merge into one definition.
- 7.C.2 wording: "Cross-file merge — two files contributing to
  same partial unified." `cross-file-merge/master.wit` +
  `one.wit` + `two.wit` is the minimal probe: master never
  declares `#bibliography`; one.wit and two.wit each contribute
  one `+#bibliography:`; master invokes `@bibliography`.
- Three candidate rules:
  (a) **shared namespace across reference graph** — `+#name`
      contributions in any file reachable from the entry file
      merge into one definition keyed by `name`. Matches the
      M1.07 lean ("global within ref graph"); cross-file is the
      designed path, not the exception.
  (b) **per-file namespace, explicit join syntax** — `+#name`
      is file-local unless the author opts in via a join
      directive. Adds new syntax; loses the example file's
      self-assembling behavior.
  (c) **opt-in per-name** — author tags some names as cross-
      file-additive and others as file-local. Adds a second
      sigil; complicates the surface.
- **Concrete proposal:** rule (a). Ratifies M1.07's lean and
  matches `examples/16-additive-partials/` directly. The
  reference graph IS the scope; if two files in unrelated
  graphs happen to share a `+#name`, they never merge because
  the resolver never visits both at once. Not committed;
  surface at M1.review.
- Open under proposal (a): name collisions between cross-file
  `+#name` contributions and a file-local non-additive `#name`
  (e.g. master.wit declares `#bibliography:` locally, chapter
  declares `+#bibliography:`). Resolved by the "Mix normal +
  additive" proposal above (base + additives compose). The
  cross-file fixture does not probe this composition; the in-
  file fixture `mix-normal-and-additive.wit` does.
- Open: cross-file contribution with `+#name` declared inside
  a file that is referenced from two different masters — the
  same contribution appears in two different reference graphs.
  Each master sees its own merged definition; contributions
  are not shared across masters. Not probed; lean obvious.

## Captures on `+#x` (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6 (capture lists), DS-7,
`additive-with-captures.wit`, 07-definitions/_notes.md
(capture-list shape and `||` reservation).

- `additive-with-captures.wit` probes `+#bibliography
  ||author, work|| ::author::, ::work:: !!`. Question: are
  captures legal on an additive contribution, and how do they
  compose across multiple contributions?
- Three candidate rules:
  (a) **first contribution declares captures; subsequent
      contributions inherit** — the first `+#name` declaration
      that carries a capture list defines the parameter
      signature for the merged definition. Subsequent
      contributions may reference the same captures via
      `::name::` but may not redeclare them. Conflicting
      capture-list declarations across contributions are an
      error.
  (b) **captures forbidden on `+#name`** — `+#name` is body-
      contribution only; if you need captures, you need a non-
      additive base `#name ||a, b||` with additives appending.
      Pushes the capture-declaration role onto the "base" of
      the "Mix normal + additive" proposal.
  (c) **per-contribution captures, locally scoped** — each
      `+#name` contribution declares its own captures, which
      bind only inside that contribution's body. The merged
      definition's surface captures are the union of all
      contributions' captures. Conflicting names across
      contributions are an error.
- **Concrete proposal:** rule (b). Cleanest composition with
  the "base + additives" proposal: the non-additive `#name`
  base owns the signature (captures, body slot, shape
  expectations); additives extend the body only. Authors who
  want a parameterised additive definition write a base
  `#name ||a, b||` first (possibly with an empty body, possibly
  via the master file in the cross-file pattern). Rule (a) is
  defensible but creates a "first contribution wins"
  ordering surprise; rule (c) requires per-contribution scope
  tracking and complicates `::name::` resolution. Under (b),
  `additive-with-captures.wit` is an ERROR fixture — the
  capture list on `+#bibliography` is illegal because there is
  no non-additive base. Not committed; surface at M1.review.
- Open under proposal (b): if the rule lands as proposed,
  `additive-with-captures.wit` re-roles as an error probe
  rather than a happy-path fixture. Lean: keep it; the fixture
  pins the diagnostic location (`loc` at the `||` opener of
  the additive declaration). The fixture name stays
  descriptive of what it contains rather than its expected
  outcome, consistent with `mixed-body-shape.wit`.
- Open: interaction with `::name::` inside an additive body
  when the base declares captures `||a, b||` and the additive
  body references `::a::`. Lean: legal, the additive sees the
  base's capture environment because they merge into one
  definition. Not probed.

## Bare `+#x` with no base or sibling (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-7,
`simple-additive-prefix.wit`,
`block-additive.wit`, `single-line-additive.wit`.

- `simple-additive-prefix.wit`, `block-additive.wit`, and
  `single-line-additive.wit` each contain exactly one `+#name`
  declaration. There is no non-additive `#name` base, and no
  other `+#name` sibling. The fixture invokes `@name` against
  this lone contribution. Question: is this legal?
- Three candidate rules:
  (a) **a single `+#x` is a complete definition** — the
      additive prefix marks the declaration as "open for
      contribution" but does not require additional
      contributions to exist. A lone `+#x` resolves to a
      regular `NodeDef` with `additive: true` and a single-
      contribution body. Under (a), all three single-`+#name`
      fixtures expand cleanly.
  (b) **`+#x` requires at least one sibling or a base** — a
      lone `+#x` errors at resolve time because the additive
      prefix promises a contribution to a multi-contributor
      definition that never materialises. Forces authors to
      either drop the `+` or add a base; surprising surface
      for the chapter-registration pattern (one chapter loaded
      in isolation should still produce a one-entry
      bibliography).
  (c) **`+#x` requires a base** — additive prefix is purely
      a "contribute to existing" marker; a `+#x` with no
      `#x` base anywhere in the reference graph is an error.
      Forces master files to declare placeholder bases for
      every additive name; brittle.
- **Concrete proposal:** rule (a). Matches the
  `examples/16-additive-partials/` story where the master file
  never declares `#bibliography` and the chapters self-
  register. Loading a single chapter in isolation must still
  yield a working `@bibliography` invocation with one entry.
  The `additive: true` flag on the merged `NodeDef` is still
  meaningful even with a single contribution (renderer / tools
  may still want to know "this name accepts contributions").
  Rule (b) loses single-chapter rendering; rule (c) forces
  ceremony. Not committed; surface at M1.review.
- Open under proposal (a): rendering distinction between a
  one-contribution additive and a non-additive definition.
  Same surface bytes; only `additive: true` differs in the AST.
  Renderer behavior is not in this category's scope (M4
  territory). Not probed.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing
  LF. No CR/LF or BOM variants; byte-level probes live in
  00-lexical.
- The `cross-file-merge/` subdirectory uses relative
  `reference ./one.wit` paths to match
  `examples/16-additive-partials/master.wit` style. Path
  resolution semantics (DS-8) are not under test here.
- Not probed in this category and deferred:
  - `+#name` declared inside another definition's body
    (nested) — interacts with the broader M1.07 nested-
    definitions question;
  - `+#name` colliding with a builtin or scripted-defined name
    (M1.13 / M1.17 territory);
  - merging contributions whose bodies reference each other's
    captures cross-contribution (see "Captures on `+#x`"
    open question);
  - source location attribution on merged-AST child nodes
    (PLAN.md I.14) — every `+#name` contribution carries its
    own `loc`, but the merged parent `NodeDef`'s `loc` policy
    is unprobed;
  - error recovery: a malformed `+#name` contribution mid-
    merge — does the resolver skip the bad contribution and
    keep the others, or does the whole merge fail?
  - whitespace between `+` and `#` (`+ #name`) — accept,
    error, or treated as two tokens? Lean: error (the prefix
    must be exactly `+#`).
