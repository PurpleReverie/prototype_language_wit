# 05-nodes-parens fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the parens-form of node use — `@name(params)` —
self-closing, params at the open, no `name@` closer, no body.
Spec page 5 / example file `examples/05-parameters.wit`:

- Parens-form is comma-separated. Inside each slot the same three
  shapes that pipes carry apply: positional (single word),
  named (`key value`, hyphen for multi-word keys), and flag
  (trailing `!`).
- Parens-form is self-closing by construction: the closing `)`
  ends the node. There is no `name@` closer and there is no body.
  Bodies require the pipe-form (W4.3 / 06-parameters-pipes).
- W4.4 / DS-5 / 5.C.2: "`@badge(tone good)` no body, no close."
  This category is the first place that contract bites.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

## Multi-word flags via parens (PLAN.md I.12)

Cross-refs: PLAN.md DS-5, 5.U.6, 5.C.4, W4.4.

- I.12 asks: "Multi-word flags via parens: `@badge(full width!)`
  — whole flag or single word?" `mixed-params.wit` probes this
  directly with `full width!` as the second slot of
  `@figure(src lamp.png, full width!, caption The lens)`.
- Three candidate rules:
  (a) **whole-slot flag** — the slot bytes from the previous
      comma (or `(`) up to the trailing `!` form one flag whose
      name is the bytes minus the `!`, with inner whitespace
      preserved as a single space run. Under (a), the flag in
      `mixed-params.wit` is `full width` (two-word name, `!`
      consumed as the flag marker).
  (b) **single-word flag** — only the final word before the `!`
      is the flag; preceding words on the slot are dropped or
      treated as a syntax error. Under (b), `full width!` is
      either the flag `width` with stray `full` (error or
      discarded) or rejected outright.
  (c) **positional-with-bang** — `full width!` is a positional
      value whose final byte happens to be `!`; not a flag at
      all. Under (c), the slot is the positional string `full
      width!` and `!` carries no special meaning inside parens.
- **Concrete proposal:** rule (a). Parity with the pipe-form
  contract in 5.C.4 (`|full width!|` → flag.name="full width")
  is the strongest argument; the pipe and parens forms are
  documented (DS-5 / examples/05-parameters.wit) as "same three
  shapes apply inside." Under (a) the parens form keeps that
  parity intact; under (b) or (c) the parens form silently
  diverges from pipes and authors have to remember which
  syntax allows multi-word flags.
- Open under proposal (a): does a mid-slot `!` (e.g.
  `caption Wow! lens`) end the slot the way it does NOT in pipes
  (5.U.5)? Lean no — pipes' rule "mid-value `!` is just
  punctuation; only the final `!` before the delimiter counts"
  should carry over to parens with `,` and `)` as the delimiters.
  Not probed in this category; a future probe
  `bang-mid-value.wit` belongs here once the rule is committed.

## Parameter value quoting (PLAN.md I.4)

Cross-refs: PLAN.md DS-5, 5.U.1–5.U.6.

- I.4 asks: "Parameter values — always unquoted, or quoted for
  special-char values?" The parens form puts more pressure on
  this than pipes do because the parens delimiter set is
  larger: `,`, `)`, and the flag marker `!`. None of the
  fixtures in this category contain a literal comma, paren, or
  unintended `!` inside a value, and no quoting syntax is
  exercised. The category leaves I.4 unprobed.
- Lean (no commitment): values inside parens are unquoted and
  any literal comma / paren / non-flag `!` needs an escape
  mechanism that does not yet exist. Three rough options for
  the reviewer:
  (i)   **no escape; pipes-only for special chars** — if your
        value contains `,` `(` `)` `!`, use `|key value|` (or
        whatever the body-form ends up being). Cheapest;
        documents a real expressivity hole.
  (ii)  **backslash escape** — `@x(caption Wow\, lens)` legal.
        Adds one rule; cross-cuts every other categorical
        delimiter (pipes' `|`, body's `~`, etc.) for parity.
  (iii) **quoted-string slot** — `@x(caption "Wow, lens")`.
        Adds a quoting layer to the parens grammar that no
        other Wit surface currently has.
- Open (no PLAN entry — new I.review item): a literal `!` mid
  value in parens. The pipe-form rule (5.U.5) is "mid-value `!`
  is NOT a flag marker; only the final `!` counts." The same
  rule, transposed to parens, says "mid-value `!` is fine; only
  a `!` immediately before `,` or `)` is a flag marker." Lean
  yes (carry the pipe rule across), but not probed here.
- Open (no PLAN entry — new I.review item): an unbalanced `(`
  or `)` inside a value. Lean: parens are not nestable inside a
  slot under any of (i), (ii), (iii) above; literal parens
  inside a value require option (ii) or (iii). Not probed.

## Mixing parens + pipes (PLAN.md I.11) — downstream

Cross-refs: PLAN.md DS-5, 5.C.5.

- I.11 asks: "Mixing parens and pipes on same node — error, or
  merge?" Not exercised in this category. Every fixture here
  uses parens only; no `@x(a) |b c|` shape is authored. Surfacing
  as downstream so the reviewer sees the link.
- The classification ambiguity: parens-form is self-closing
  (DS-5 / 5.C.2). A node with parens cannot also carry a body,
  so pipes on the same `@x(...)` would either (a) be illegal,
  because parens already closed the node, or (b) attach to the
  next opening of `@x` on the document (unlikely; would require
  cross-instance merging), or (c) silently merge into the same
  Param[] before the parens close (would require pipes to
  appear after the closing `)` on the same line or before the
  opening `(` — neither is natural).
- Lean (a). The parens-form is documented in
  `examples/05-parameters.wit` as "parens — self-closing,
  params at the open" with the explicit guidance "with body:
  use open/close and pipes instead." That phrasing reads as a
  hard either/or. Not committed; defer to M1.review.
- Open (no PLAN entry — new I.review item): is the error a
  parse error (the lexer never produces a mixed-syntax node)
  or a resolver error (the parser accepts both and the
  resolver rejects)? Lean parse error — cheaper to surface,
  and the lexer already has both delimiters under its eye.
  Not probed here; a fixture for this question belongs in
  `tests/errors/` once the error model is enumerated (DS-15).

## `!!` close + parens (PLAN.md I.17) — downstream

Cross-refs: PLAN.md DS-21, DS-5, I.7, I.16.

- I.17 asks: "Combining `!!` close with parens (`@name(p, q) body
  !!`) — allowed?" Not exercised in this category. Every
  fixture here either has no body at all (the canonical
  parens-form contract) or carries the body inside the same
  line via an explicit `name@` closer (`parens-then-body.wit`).
  No `!!` short-close appears.
- The classification ambiguity is the same one that drives I.11:
  if parens is self-closing by construction, then `@name(p) body
  !!` has no opener for `!!` to close — the parens already
  closed the node. The `body` and `!!` are then either
  (a) prose that follows the self-closed node, with `!!` as
      stray punctuation (which under I.7 option (B) is
      reserved and errors, under (A) is harmless because no
      opener is active, under (C) is conditional on line
      position), or
  (b) evidence that parens is NOT self-closing when followed
      by body bytes on the same line, in which case parens-form
      collapses into the pipe-form's open/close contract with
      `!!` as the short-close.
- `parens-then-body.wit` (`@aside(tone wry) the keeper said
  nothing aside@`) probes (b) without `!!` — it uses the
  long-form closer `aside@`. That fixture is the cheapest
  reading of the same ambiguity: does the explicit closer
  override the parens-is-self-closing default, or is the
  closer an error because the node already closed at `)`?
- Lean: the parens-form is self-closing strictly. `@x(p) body
  x@` is two things — the self-closed `@x(p)` node, then a
  prose run `body x@` whose `x@` is a stray close with no open
  (an error under DS-15). Under this reading, the I.17 case
  `@name(p, q) body !!` is also an error: `!!` has no active
  opener. Not committed; surface at M1.review.
- Open (no PLAN entry — new I.review item): does the parens
  syntax need its own short-close variant at all, given that
  parens is already self-closing? Lean no — `!!` is the
  short-close for the pipe-form's open/close contract; parens
  has no analogous contract to short-close.

## Self-closing classification rule (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, 4.S.2, DS-5, 5.C.2, examples/05-parameters.wit.

- `self-closing.wit` is the canonical pair to
  `04-nodes-use/block-name-body.wit` and
  `04-nodes-use/inline-name-body.wit`. The parens-form has no
  closer and no body; the next non-blank line is a separate
  paragraph (or a separate construct), not the node's body.
- The classifier (4.S.2) for the pipe-form is "Standalone-line
  NodeUse → block; inside paragraph → inline." For the
  parens-form, the equivalent rule has two candidate shapes:
  (a) **same classifier** — `@badge(tone good)` on its own line
      classifies as block (standalone) and inside a sentence as
      inline. The AST records position the same way, and the
      renderer decides whether the absence of a body matters.
  (b) **always-inline-or-always-block** — parens-form has no
      body, so the block/inline distinction is renderer-only;
      the AST records a single shape tag `self-closed` and
      lets position propagate via `loc` without a classifier
      verdict.
- **Concrete proposal:** rule (a). Parity with the pipe-form
  classifier is cheap; the parser already inspects "standalone
  line vs inside paragraph" for the long-form NodeUse and
  reusing that rule for parens-form avoids a second
  classification path. `self-closing.wit` puts `@badge(tone
  good)` on its own line, followed by prose on the next line
  with no blank line between; the fixture pins the question
  "does the parens-form on its own line classify as block, and
  does the following prose start a separate paragraph?" Lean
  yes to both; cross-cuts I.2 (single newline within paragraph).
- Open under proposal (a): when an `@x(...)` appears inside a
  prose paragraph (`She wore a @badge(tone good) and smiled.`),
  the classifier should call inline. Not probed in this
  category; one fixture short of the matrix. Lean to add
  `inline-parens-in-prose.wit` in a follow-up slice once the
  rule is committed.

## Empty `()` semantics (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.C.2, 5.U.6.

- `empty-parens.wit` is `@x()` on a single line. The fixture
  pins the question: is `@x()` legal at all, and if legal, is
  it equivalent to the bare reference `@x` (which has its own
  semantics in 04-nodes-use) or to a node with an empty
  `Param[]` whose source tag is `parens`?
- Three candidate readings:
  (a) **legal; equivalent to `@x`** — the empty parens collapse
      to a bare reference. The AST records no `Param[]` and the
      `ParamSource` tag is dropped. Under (a) the bare-reference
      boundary rule (I.6 / 04-nodes-use) applies and `@x()` is
      indistinguishable from `@x` followed by `()` as prose.
  (b) **legal; distinct from `@x`** — `@x()` self-closes (per
      the parens-form contract) with `Param[] = []` and
      `ParamSource = 'parens'`. Under (b) the AST distinguishes
      "node referenced bare" from "node self-closed with no
      params"; renderers and resolvers can use the distinction.
      Bare-reference fixtures in 04 stay bare; parens fixtures
      here keep their source tag.
  (c) **illegal** — empty parens are a syntax error (no slot to
      parse). Authors must write `@x` for the bare form.
- Lean (b). The pipe-form has no zero-pipe analogue (you don't
  write `@x |` `|`), so empty parens is the only place the
  "self-closed but no params" shape can be expressed. Keeping
  that shape distinct from the bare reference preserves
  expressivity. Cross-refs DS-5 / 5.S.2 (`ParamSource = 'parens'
  | 'pipes'`): if (a) is picked, the source tag has nothing to
  record for the empty case. Not committed; surface at M1.review.
- Open (no PLAN entry — new I.review item): does `@x()` followed
  by body and closer (`@x() body x@`) collapse into `@x body
  x@`, or is the empty-parens form strictly self-closing the
  same way `@x(a)` is? Cross-cuts I.17 above. Not probed.

## Trailing comma policy (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, DS-9, 9.U.6.

- `trailing-comma.wit` is `@x(a,)`. The fixture pins the
  question: is a trailing comma legal in the parens-form, and
  if so, does it produce an extra empty slot or get tolerated
  silently?
- Cross-cuts DS-9 / 9.U.6: records and collections have an
  explicit "trailing comma tolerance" assertion. The parens
  form is a sibling list syntax (comma-separated, single-
  delimiter); parity argues for the same tolerance here.
- Three candidate readings:
  (a) **tolerated, no empty slot** — `@x(a,)` produces `Param[]
      = [Positional("a")]`. The trailing comma is consumed and
      discarded. Matches DS-9 / 9.U.6 directly.
  (b) **tolerated, empty slot** — `@x(a,)` produces `Param[]
      = [Positional("a"), Empty]`. The trailing comma creates a
      slot. Probably nobody wants this, but it is the literal
      reading of "comma separates slots."
  (c) **illegal** — `@x(a,)` errors with "trailing comma in
      params." Cheapest to parse; punishes a common authoring
      ergonomic.
- **Concrete proposal:** rule (a). Parity with DS-9 / 9.U.6 is
  the deciding argument; trailing-comma tolerance is a well-
  established ergonomic across record / collection / param
  syntaxes, and Wit already commits to it for records and
  collections. Not committed; surface at M1.review.

## Inner-whitespace normalization (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.1, 5.U.2.

- `inner-whitespace.wit` is `@x( a , b )` with one space inside
  each `(` `,` and `)` boundary. The fixture pins the question:
  is the parens-form whitespace-tolerant the way pipes are
  (`|mood calm|` and `| mood calm |` parse the same), or does
  whitespace inside parens contribute to slot values?
- Three candidate readings:
  (a) **strip leading/trailing whitespace per slot** — each
      slot is trimmed before the per-slot parser sees it.
      `@x( a , b )` → `Param[] = [Positional("a"),
      Positional("b")]`. Matches pipe-form normalization.
  (b) **preserve all bytes per slot** — the slot is whatever
      bytes appear between commas; whitespace is part of the
      positional value. `@x( a , b )` → `Param[] =
      [Positional(" a "), Positional(" b ")]`. Surprising for
      authors; useful only if author intent is "value with
      leading space."
  (c) **strip but record the bytes** — the AST records the
      trimmed value AND the source span. `Param[] =
      [Positional(value="a", raw=" a ")]`. Most expressive but
      adds a field nothing else needs.
- **Concrete proposal:** rule (a). Parity with pipe-form
  whitespace tolerance is the deciding argument; authors
  expect `(` `a` `)` to mean the same as `(a)` and the
  alternative (b) would surprise. Not committed; surface at
  M1.review.

## Hyphen-as-separator vs literal hyphen (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.2, 5.C.4, examples/05-parameters.wit.

- `hyphen-multi-word-key.wit` is `@panel(background colour -
  dark slate)`. The fixture pins the spec rule from 5.U.2 and
  `examples/05-parameters.wit` ("`|key - value|` named — hyphen
  when the key itself is multi-word") inside the parens-form.
- Three candidate readings:
  (a) **hyphen-as-separator only when surrounded by spaces** —
      `key bytes - value bytes` parses as a named param with
      key="background colour" and value="dark slate". A literal
      hyphen with no surrounding spaces (`well-known`) stays in
      the identifier / value bytes. This matches pipe-form
      behaviour by 5.U.2.
  (b) **hyphen always splits** — any `-` in the slot is a
      key/value separator. Under (b), `well-known` inside a
      slot would split into key="well" and value="known". This
      breaks the 04-nodes-use rule that hyphen is a handle
      character (`@paper-stats`), and would surprise authors.
  (c) **hyphen only when key is two-or-more words** — the
      hyphen is recognised as a separator only when the slot
      bytes before the first space-hyphen-space contain a
      space. Under (c), `key value` (no hyphen) and `multi
      word key - value` (hyphen) both parse named; `keyvalue`
      with no space (`well-known`) does not split.
- **Concrete proposal:** rule (a). Both (a) and (c) avoid the
  surprise in (b); (a) is the simpler rule and matches the
  documented pipe-form syntax in `examples/05-parameters.wit`
  most directly ("hyphen when the key itself is multi-word"
  reads as "use ` - ` to mark the boundary," not "any hyphen
  splits"). The pipe-form fixtures will need a literal-hyphen
  probe (`well-known` as a slot value) under any of (a) (b)
  (c) to disambiguate; that belongs in 06-parameters-pipes,
  not here.
- Open (no PLAN entry — new I.review item): a slot whose value
  is itself a hyphenated word (`@x(slug well-known)`). Lean (a)
  parses key="slug", value="well-known" because the first
  space splits key/value and the embedded hyphen is just
  identifier bytes. Not probed in this category.

## Parens-then-body shape (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.C.2, 5.C.5, I.11, I.17,
examples/05-parameters.wit.

- `parens-then-body.wit` is `@aside(tone wry) the keeper said
  nothing aside@`. The parens-form contract (5.C.2 / examples)
  is "self-closing, no body, no close." This fixture violates
  that contract by following the closing `)` with body bytes
  and an explicit `aside@` closer on the same line.
- Three candidate readings:
  (a) **error — closer with no open** — the parens already
      closed the node at `)`; the trailing `aside@` is a stray
      closer for which no opener is active. Lean error under
      DS-15. The body bytes are prose.
  (b) **explicit closer overrides parens self-closing** — when
      a parens-form is followed on the same line by an explicit
      `name@` closer, the parens-form becomes a long-form
      NodeUse with `Param[]` populated from inside the parens
      and a body populated from the bytes between `)` and
      `name@`. The two forms compose.
  (c) **two nodes** — `@aside(tone wry)` self-closes, then
      `the keeper said nothing aside@` is a separate inline
      NodeUse with body `the keeper said nothing` and no
      params. Probably nobody wants this; the second `@aside`
      has no `@` opener so it cannot be a NodeUse at all.
      Listed only for completeness.
- Lean (a). The parens-form is documented as self-closing
  without exception, and `examples/05-parameters.wit` says
  "with body: use open/close and pipes instead." Under (a) the
  fixture is an error — useful as a probe for the error model
  (DS-15) but not a happy-path fixture. Cross-cuts I.11 and
  I.17 above; if either is resolved in favour of "mix
  allowed," this fixture may flip from error to happy-path.
- Open (no PLAN entry — new I.review item): if (b) is picked,
  what does `Param[]` look like for a parens-then-body node?
  The `ParamSource` tag in DS-5 / 5.S.2 is `parens | pipes` —
  is there a third value `mixed` for this shape? Not committed;
  defer to M1.review.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing
  LF. No CR/LF or BOM variants of parens-specific cases are
  authored — byte-level probes live in 00-lexical.
- Not probed in this category and deferred:
  - parens with `!!` short-close (I.17 — see downstream
    section above);
  - parens with body via explicit closer (`parens-then-body.wit`
    surfaces the ambiguity but the resolution is deferred);
  - inline parens-form inside a prose paragraph (the inline
    classification half of `self-closing.wit`);
  - literal comma / paren / non-flag `!` inside a slot value
    (I.4 — see "Parameter value quoting" above);
  - parens with access-path key (`@x(@scope.field something)`)
    — not probed; access-path semantics inside parens are
    deferred to W6.6 / DS-10.

## M16 known-bug pin: parens break on newlines

- `multi-line-call.wit` pins the current behaviour: a `(...)` call
  whose contents span a `\n` does not consume past the newline. The
  lexer's param state (`lexParamState`) breaks on `\n` — the rest of
  the call (including the closing `)`) ends up in the surrounding
  text run. M16 brief notes this as a known bug; the fixture's
  snapshot captures the (surprising) current output. Fixing the
  lexer to allow newlines inside parens is deferred.
