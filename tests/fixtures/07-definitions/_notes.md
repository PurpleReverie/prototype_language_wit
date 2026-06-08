# 07-definitions fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the definition-side of the language — `#name ... name#`
(block), `#name: value !!` (single-line), `#name:\n...\n!!`
(value-block), `||a, b, c||` capture lists, `::name::` interpolation,
and `...` body slot. This is the form authors use to DEFINE a
template that `@name` invocations expand. The use-side of `@name`
landed in 04-nodes-use (no params), 05-nodes-parens (parens), and
06-parameters-pipes (pipes); definitions consume those at expansion.
Spec page 7–8 / example files `examples/07-defining-nodes.wit` and
`examples/08-single-line-defs.wit`:

- Definition shapes from DS-6 / 6.S.4: `block` (`#name ... name#`),
  `single-line` (`#name: value !!`), `value-block`
  (`#name:\n ... \n!!` — value spans lines, may contain other nodes).
- Capture lists `||a, b, c||` declare the parameter names a
  definition will accept. The use-side passes values via pipes or
  parens; the definition body references them via `::a::`,
  `::b::`, `::c::`.
- Interpolation `::name::` is an inline AST node (6.S.2) that
  surfaces a captured value at expansion. Outside a definition,
  `::name::` should not be recognized as an interpolation — only
  the definition body context activates the form.
- Body slot `...` (6.S.3 / W12.5 / 6.U.3) marks where the
  invocation's body bytes flow in at expansion. A definition may
  omit `...` (no contributed body) or place it once anywhere in
  the body.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

## `!!` greedy-parse risk (PLAN.md I.7)

Cross-refs: PLAN.md DS-6, 6.U.4, 6.C.2, 6.C.3, W12.2, W12.6,
05-nodes-parens/_notes.md (downstream link from M1.05),
`examples/08-single-line-defs.wit`.

- I.7 asks: "`!!` greedy-parse risk in body prose — context-only,
  always-reserved (`\!!` escape), or position-restricted?" This
  category is the first place `!!` carries semantic weight: it is
  the value-block terminator for `single-line` and `value-block`
  definition shapes. Probed structurally by `single-line-def.wit`,
  `multi-line-value.wit`, `single-line-def-with-captures.wit`.
- Three candidate rules:
  (a) **context-only `!!`** — `!!` is recognized as a terminator
      only inside the open value of a `#name:` or `#name:\n`
      definition. Outside that context (prose, body, slot
      content), `!!` is two literal bang bytes. Under (a), an
      author who writes `He shouted !!` inside a paragraph
      produces a Text run with literal `!!`; no terminator
      fires because there is no open `#name:` value to close.
  (b) **always-reserved `!!`** — `!!` is always the
      definition-value terminator; literal `!!` in prose
      requires an escape (`\!!` or similar). Under (b), every
      paragraph that wants to say "Hooray!!" must escape, and
      the M1.01 prose category's `punctuation-heavy.wit` would
      retroactively need an audit.
  (c) **position-restricted `!!`** — `!!` is a terminator only at
      end-of-line or after a closing newline; mid-line `!!` is
      literal. Under (c), `#cite: ||author|| ::author:: !!`
      works because the `!!` sits at end-of-line; `He shouted
      !!` mid-paragraph stays literal.
- **Concrete proposal:** rule (a). The lexer / parser already
  needs to know whether it is inside an open `#name:` value
  (the same machinery that closes the value at the matching
  `!!`); reusing that machinery for `!!` recognition is the
  cheap option. Rule (b) would force escape audits across every
  prior category; rule (c) adds an additional positional
  predicate on top of (a) without buying anything new. Under
  (a), the fixtures in this category are the only place `!!`
  carries meaning in the corpus so far; everywhere else it is
  literal. Not committed; surface at M1.review.
- Open under proposal (a): does the `!!` terminator allow
  trailing whitespace before EOL (`!! \n`) or require an exact
  byte sequence? Lean: trailing whitespace tolerated (matches
  pipe-form trailing-space tolerance in 06-parameters-pipes).
  Not probed in this category.
- Open under proposal (a): nested definitions inside a
  `value-block` definition value — does a `#inner: ... !!`
  embedded in an open `#outer:` value close the OUTER value
  at its `!!`, or only the inner? Lean: innermost wins (LIFO,
  the standard nested-construct rule). Not probed in this
  category; deferred to combinations / errors.

## Body slot positioning (PLAN.md I.16)

Cross-refs: PLAN.md DS-6, 6.U.3, 6.S.3, W12.5, 6.C.1,
`examples/07-defining-nodes.wit`.

- I.16 asks: "Short-close `!!`: inline-only, or block-allowed?"
  Adjacent and probed implicitly by `body-slot.wit` and
  `body-slot-only.wit`. The body-slot `...` itself is a separate
  surface, but the question "where can `...` appear inside a
  definition body" composes with the same positional rule.
- Three candidate rules for body-slot positioning:
  (a) **at-most-once, anywhere** — a definition body may contain
      zero or one `...` marker, at any position. Multiple `...`
      markers in one body is an error. Under (a),
      `body-slot.wit` places `...` between `@panel` open and
      `panel@` close; legal.
  (b) **at-most-once, line-leading** — the `...` marker must sit
      at the start of a line (after optional indent) to be
      recognized as a slot; mid-line `...` is literal ellipsis
      text. Under (b), `body-slot.wit` still parses because the
      marker is on its own line.
  (c) **multiple allowed, body bytes split** — a definition may
      contain N body-slot markers; the invocation's body bytes
      are split across them at expansion. Adds a non-trivial
      expansion-time split rule.
- **Concrete proposal:** rule (a). Matches PLAN W12.5 wording
  ("Mark where the invocation body should render" — singular).
  Authors who want multiple insertion points are reaching for
  composition (multiple definitions) or scripting (`<% %>`),
  both of which are out of scope for DS-6. Not committed;
  surface at M1.review.
- Open under proposal (a): is `...` literal ellipsis text
  permitted in a `#single-line:` definition value (e.g.
  `#trail: ... and so on !!`)? Lean: yes — the body slot is
  meaningful only in `block` definitions; inside `single-line`
  / `value-block` values, `...` is ellipsis text. The
  classification rides on the definition shape. Not probed.
- Open under proposal (a): four or more dots (`....`) — literal
  text or body slot plus dot? Lean: `...` is the slot exactly
  (three bytes); `....` is the slot plus a literal dot or
  rejected as ambiguous. Not probed.

## Forward references and hoisting (PLAN.md I.8)

Cross-refs: PLAN.md DS-6, DS-9 / I.9 (definition scope),
W12.*, `examples/07-defining-nodes.wit`,
04-nodes-use/_notes.md (use-side surface).

- I.8 asks: "Forward references — `@x` before `#x`? Lean yes
  (hoisted)." `forward-reference.wit` probes this directly: the
  prose uses `@year` and `@keeper` before the `#year:` /
  `#keeper:` definitions appear later in the file. PLAN already
  leans yes; the fixture pins the assertion.
- Three candidate rules:
  (a) **fully hoisted** — definitions are collected in a single
      pass and made available everywhere in the file, regardless
      of source order. `@x` before `#x` resolves identically to
      `@x` after `#x`. Under (a), `forward-reference.wit`
      resolves cleanly.
  (b) **scope-by-source-order** — `@x` resolves only against
      definitions that appear earlier in the source. Under (b),
      `forward-reference.wit` would error: `@year` and `@keeper`
      have no definition in scope at the time they are used.
      Easier on a single-pass parser; surprising for authors who
      want to put boilerplate definitions at the bottom.
  (c) **resolved-at-expand-time** — parser does not bind
      references at all; the resolver / expander does the lookup
      across the whole file. Under (c), source order does not
      matter at any stage; `@x` is a deferred symbol until
      expansion. Matches the 5-stage pipeline in section C.
- **Concrete proposal:** rule (c), which subsumes (a). The
  resolver stage exists exactly to do this lookup; the parser
  emits unresolved `@x` invocations and `#x` definitions, and
  the resolver binds them regardless of source order. Authors
  see (a) — full hoisting — as the surface behavior. Matches
  PLAN's "Lean yes (hoisted)" and the C-section architecture.
  Not committed; surface at M1.review.
- Open under proposal (c): definition redefinition — two `#x:`
  blocks in one file. Error, last-one-wins, or merge? Lean:
  error unless the second carries the `+#x` additive prefix
  (DS-7 / M1.08 territory). Not probed in this category; the
  fixtures have unique definition names.
- Open under proposal (c): cross-file forward reference — does
  `@x` in file A resolve to `#x` in file B if both are in the
  same reference graph? Cross-cuts I.9. Not probed; deferred to
  M1.15 / cross-file references.

## Definition scope (PLAN.md I.9)

Cross-refs: PLAN.md DS-6, I.8 (forward references),
`examples/07-defining-nodes.wit`,
`definition-references-definition.wit` in this category.

- I.9 asks: "Definition scope — file-local or merged across
  references? Lean global within ref graph."
  `definition-references-definition.wit` is the in-file version
  of the question: a `#bio` definition body references `@keeper`
  which is itself a definition in the same file. PLAN already
  leans global within a reference graph; this fixture pins the
  in-file case.
- Three candidate rules:
  (a) **file-local, no cross-file lookup** — definitions are
      visible only within the file that declares them. The
      `examples/15-references/` story handles cross-file merge
      separately. Under (a), the in-file `#bio` -> `@keeper`
      resolves cleanly; cross-file is out of scope here.
  (b) **global within ref graph** — every file that is reachable
      via `references` shares one definition namespace. Same
      `#x` in two files is a conflict.
  (c) **module-style with explicit import** — definitions are
      file-local unless explicitly imported. Wit does not have
      an import statement today, so this would require new
      syntax. Out of scope.
- **Concrete proposal:** rule (b), affirming PLAN's lean. The
  in-file fixtures in this category are the trivial case of
  (b) (one file = one ref graph node). Cross-file merge is the
  full case, deferred to M1.15. Not committed; surface at
  M1.review.
- Open under proposal (b): identical definitions in two files
  (same `#x` body verbatim) — error, no-op, or last-loaded
  wins? Lean: error unless `+#x` additive. Not probed.

## Interpolation context (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6, 6.S.2, 6.U.2, W12.4,
`examples/07-defining-nodes.wit`.

- `::name::` is recognized as an interpolation token only inside
  a definition body. Outside that context — in plain prose, in a
  node use's body, in a parameter value — the bytes `::foo::`
  should either be literal or error.
  `captures-and-interpolation.wit`, `interpolation-only.wit`,
  `captures-body-slot-interpolation.wit`, and
  `single-line-def-with-captures.wit` all sit inside definition
  bodies; none of the fixtures place `::name::` outside a
  definition. The question is which behavior the parser should
  exhibit when an author misplaces an interpolation.
- Three candidate rules:
  (a) **context-only, literal outside** — `::name::` is
      recognized as interpolation only inside a definition body;
      anywhere else, the bytes flow into a Text run. Under (a),
      `He said ::hello::` in a paragraph produces Text bytes
      with literal colons.
  (b) **always recognized, error outside definition** — the
      parser always tokenizes `::name::` as interpolation; the
      resolver errors if it sees one outside a definition body.
      Adds parse/resolve coupling but surfaces author intent.
  (c) **always recognized, deferred** — the parser tokenizes the
      shape; the resolver leaves unbound interpolations as
      diagnostics. Same as (b) but the diagnostic is softer.
- **Concrete proposal:** rule (a). Parity with the I.7 proposal
  above (context-only `!!`); the same machinery that knows
  "currently inside a definition body" gates both `!!`
  recognition and `::name::` recognition. Under (a), authors
  who write `::foo::` in prose get literal text; the
  classification is purely positional. Not committed; surface
  at M1.review.
- Open under proposal (a): nested definitions — a definition
  body that itself defines another definition (e.g. `#outer
  ... #inner ... inner# ... outer#`) — does the inner
  definition's body see the outer's captures via `::name::`?
  Lean: yes, lexical scope nests outward. Cross-cuts I.9. Not
  probed.
- Open: interpolation of a name that is not in the capture list
  (`#x ||a, b|| ::c::`) — error at parse, error at resolve, or
  empty expansion? Lean: resolve-time error with `loc` at the
  `::c::` token. Not probed.

## Capture-list shape and `||` reservation (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6, 6.U.1,
06-parameters-pipes/_notes.md (the empty-pipe carve-out),
`examples/07-defining-nodes.wit`.

- 06-parameters-pipes/_notes.md's empty-pipe proposal carved
  out `||` from body context — `||` in body context errors,
  but `||...||` in definition-opener context starts a capture
  list. This category exercises capture-list opener context
  via `captures-and-interpolation.wit`,
  `interpolation-only.wit`,
  `captures-body-slot-interpolation.wit`,
  `single-line-def-with-captures.wit`, and `multi-capture-list.wit`.
- The composition rule, made explicit:
  (a) **`||` in definition opener = capture list** — directly
      following `#name` (or `#name:`), `||a, b, c||` is the
      capture list. Comma-separated; whitespace around names
      stripped; trailing comma tolerated (parity with
      05-nodes-parens trailing-comma proposal).
  (b) **`||` in body = error** — already proposed in
      06-parameters-pipes.
  (c) **`||` mid-definition body = literal text or error** — not
      probed here; the natural extension of (a)+(b) is that
      capture lists ONLY appear in the opener position
      (immediately after `#name`), and `||` anywhere else in
      a definition body should error or be literal.
- **Concrete proposal:** ratify (a)+(b)+(c) as one composite
  rule: `||...||` is the capture-list syntax in definition
  openers ONLY. Outside that position, the rules from
  06-parameters-pipes/_notes.md apply (empty `||` errors in
  body context). This pins the `||` token to definition syntax
  and removes the overlap with pipe-form parameter syntax. Not
  committed; surface at M1.review.
- Open under proposal: empty capture list `#x ||||` — error,
  or definition with zero captures (equivalent to no `||...||`
  at all)? Lean: equivalent to no capture list (legal, zero
  captures). Not probed in this category — none of the
  fixtures use an empty capture list.
- Open: capture-list with one name followed by trailing comma
  (`||a,||`) — accept (parity with parens), or stricter? Lean:
  accept. Not probed.
- Open: capture name character class. The fixtures use lowercase
  ASCII names (`number`, `title`, `author`, etc.). Whether
  `||first-name, last-name||` (hyphens) or `||user.name||`
  (dotted) is legal is unprobed; the natural lean is parity
  with the handle character class from 04-nodes-use's I.6
  proposal (`[A-Za-z0-9_-]`, plus `.` as path-opener). Not
  probed.

## Definition shape classification (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6, 6.S.4, 6.C.2, 6.C.3,
`examples/08-single-line-defs.wit`.

- DS-6 / 6.S.4 lists three shapes: `block`, `single-line`,
  `value-block`. The fixtures pin each:
    - `block`: `block-definition.wit`,
      `captures-and-interpolation.wit`, `body-slot.wit`,
      `captures-body-slot-interpolation.wit`,
      `definition-references-definition.wit`,
      `multi-capture-list.wit`, `body-slot-only.wit`,
      `interpolation-only.wit`.
    - `single-line`: `single-line-def.wit`,
      `single-line-def-with-captures.wit`.
    - `value-block`: `multi-line-value.wit`.
- The classifier ambiguity:
  (a) **shape decided by opener byte** — `#name\n` (newline
      after name) starts `block`; `#name: value !!` (colon,
      content on same line, `!!` on same line) starts
      `single-line`; `#name:\n` (colon, then newline) starts
      `value-block`. Three distinct openers, three shapes. Under
      (a), the lexer commits to a shape at the opener and the
      parser builds the matching AST node.
  (b) **shape decided at close** — opener is ambiguous; the
      parser collects bytes until it sees a closer (`name#` or
      `!!`) and classifies retroactively. Less efficient;
      harder to give early diagnostics.
  (c) **single-line is sugar for value-block** — `#name: value
      !!` is parsed as a value-block whose value happens to be
      one line. The AST collapses the two shapes into one.
      Loses the surface distinction; renderer cannot tell them
      apart.
- **Concrete proposal:** rule (a). Matches DS-6's three-shape
  enumeration directly and gives the lexer enough information
  to commit early. Under (a), the AST records the surface
  shape via `NodeDef.shape`; renderer / formatter can preserve
  it on round-trip. Not committed; surface at M1.review.
- Open under proposal (a): `#name:` followed by content on the
  same line that contains a newline before `!!` (mixed shape
  — opens like `single-line` but value spans lines). Is the
  shape `single-line` (value happens to be multi-line) or
  `value-block` (newline-after-content forces a re-classification)?
  Lean: `value-block` once any newline appears inside the value,
  regardless of whether content existed on the opener line.
  PLAN 6.C.3 wording supports this. Not probed.
- Open under proposal (a): empty single-line value `#name: !!`
  — legal (definition with empty value), error, or pseudo-null
  marker? Lean: legal, value is empty string. Not probed.

## Definition + parens close (PLAN.md I.17) — downstream

Cross-refs: PLAN.md DS-5, DS-6,
05-nodes-parens/_notes.md (the upstream surface).

- I.17 asks: "Combining `!!` close with parens (`@name(p,q) body
  !!`) — allowed?" The flag from 05-nodes-parens flagged this
  downstream for M1.07; this category does not exercise it
  directly (no fixture mixes a `@name(...)` use-side with `!!`)
  but the question now anchors here because `!!` is the
  value-block terminator owned by definitions.
- The shape `@name(p, q) body !!` is using `!!` as a
  short-close marker on a USE-SIDE invocation, not a
  definition. That is a different role for the same token.
  Three candidate rules:
  (a) **`!!` is definition-only** — `!!` is reserved for
      definition value terminators; using it as a use-side
      close is an error or literal. Under (a), I.17 resolves
      "not allowed."
  (b) **`!!` is dual-role** — `!!` closes either a definition
      value OR a parens-form use that has no matching
      `name@`. The lexer disambiguates from context.
  (c) **`!!` is a generic short-close** — `!!` always closes
      the nearest open construct (def value, use-side parens
      body, or `value-block`). Maximum overloading.
- **Lean (not committed; cross-reference to M1.05 I.17
  flag):** (a). The cleaner separation keeps `!!` semantics
  narrow and avoids the parse/resolve coupling that (b) or
  (c) would require. Not probed here; deferred to M1.review.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing
  LF. No CR/LF or BOM variants are authored; byte-level probes
  live in 00-lexical.
- Not probed in this category and deferred:
  - additive partials (`+#name`, DS-7) — M1.08 territory;
  - nested definitions (`#outer ... #inner ... inner# ... outer#`)
    — interaction with I.7 / I.9 scope rules; not exercised here;
  - definition redefinition (`#x` twice in one file) — error vs
    additive vs override; deferred until M1.08;
  - interpolation of an undeclared capture (`::z::` when
    `||a, b||` declares only `a, b`) — error timing;
  - mixed-form `value-block` whose value contains a node use
    that itself references the enclosing definition's captures
    — cross-cuts I.9 scope and interpolation context;
  - `...` as literal ellipsis inside a `single-line` value (see
    I.16 section above);
  - `!!` in body prose (literal vs reserved) — see I.7 section
    above;
  - capture-list with non-ASCII names (Unicode policy carry-over
    from 02-emphasis / 04-nodes-use Unicode-handle question).
