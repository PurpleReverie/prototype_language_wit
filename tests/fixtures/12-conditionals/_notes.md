# 12-conditionals — author notes

`(if cond) ... (end)` and `(if cond) ... (else) ... (end)` block
statements with comparison operators `is` / `equals` and bare-reference
truthy form. Lands E.1, W13.*, A2.* against DS-11. Records (M1.09) and
data-access (M1.11) supply the operand surface; conditions reference
already-defined static data via `@x.y` paths. Mutation, partials,
templates, and iteration are out of scope.

Forbidden-token sweep (per pack section 2): no `~ ...` narration in any
`.wit` (category ≥ 03); no `(each` (M1.13); no `<% %>` templates
(M1.04/M1.05); no `+#` partials (M1.08); no `!!` outside definition
values; no `_italic_` / `*bold*` as test subject; no `reference`
directives (M1.14). Confirmed clean.

## Comparison type coercion — string `"99"` vs number `99` (PLAN.md I.5)

`compare-against-number.wit` writes `@meter.value is 99`. M1.09 locked
bareword scalars on record RHS as typed: `value - 99` stores Number(99),
`status - draft` stores String("draft"). The comparison RHS in
`(if ... is 99)` is also a bareword — does it parse as Number(99) the
same way, and does the operator require type-equal operands?

**Concrete proposal:** rule (a) — comparison RHS uses the same M1.09
scalar typing rule as record-RHS: `is 99` parses as Number(99), `is
draft` as String("draft"), `is true` as Bool(true). Equality is
strictly type-equal: Number(99) is Number(99) succeeds; Number(99) is
String("99") fails (no coercion). Rationale: one typing rule across
the whole surface keeps DS-11 small. Authors who want string-compare
quote the literal once `!!`-strings are unlocked (deferred); for
M1.12 the bareword-as-typed-scalar discipline carries through.
Belongs in `tests/errors/` per DS-15 as the type-mismatch case.

## `is` vs `equals` — synonyms or different semantics? (no PLAN.md entry — new I.review item)

`is-comparison.wit` and `equals-comparison.wit` exercise both operators
against an identical scrutinee/operand pair. PLAN E.1 lists both
spellings without disambiguating. Two readings: (a) pure synonyms,
author preference only; (b) `is` is identity / reference-equal, `equals`
is structural / value-equal (matters once records compare).

**Concrete proposal:** rule (a) — `is` and `equals` are exact synonyms
in M1.12, both performing value-equality on scalars (Number / Bool /
String) under the strict-typing rule above. Comparing containers
(record-to-record, collection-to-collection) is an error in this
category — deferred to a later milestone where structural equality
gets its own treatment. Rationale: DS-11's "simple comparisons" framing
points at a single equality primitive with two spellings, mirroring
English ("X is draft" / "X equals draft"). Reserving `is` for identity
would surprise authors and create a near-duplicate operator nobody asked
for. If a later milestone needs identity-equal, it can introduce a
distinct keyword rather than splitting these two.

## Truthy semantics for bare-reference (no PLAN.md entry — new I.review item)

`truthy-bare-reference.wit` writes `(if @lamp.flag) body (end)` — no
operator, no RHS. PLAN E.1 lists the form but not the truth table.
Candidates for falsy: `false`, `0`, `""`, missing field, empty record
`{}`, empty collection `[]`, null/absent. Candidates for truthy:
everything else.

**Concrete proposal:** rule (a) — minimal falsy set: `Bool(false)`,
the absent / missing-field case (suppressed to falsy here rather than
erroring as it does in plain access — see the missing-field deferral
below), and a not-yet-defined value. Everything else — including
`Number(0)`, `String("")`, empty record `{}`, empty collection `[]` —
is truthy. Rationale: M1.09's typed-scalar rule means `flag - false`
is a deliberate authorial mark; `value - 0` is a real reading and
shouldn't accidentally suppress prose. Wit's authoring stance is
prose-first — the author writes `(if @x.flag)` to ask "did I mark
this?", and the answer is yes for any present value bar an explicit
`false`. Empty-string / empty-collection edges resolve cleanly under
"present is truthy".

## Empty body — then or else (no PLAN.md entry — new I.review item)

`empty-then-body.wit` writes `(if c) (end)` and `empty-else-body.wit`
writes `(if c) body (else) (end)`. Three readings: (a) legal no-op,
emits nothing; (b) warning ("empty branch — likely a mistake"); (c)
parse error.

**Concrete proposal:** rule (a) — both empty-then and empty-else are
legal no-ops with no diagnostic. Rationale: an empty branch is a
common authoring pattern when the *other* branch is the one carrying
prose, and the author hasn't yet decided what (if anything) to put in
the empty side. Treating it as an error or warning would force authors
to write filler (`-` or `nothing`) just to satisfy the parser.
Whitespace inside the empty body (the space between `(if c)` and
`(end)`) is consumed as inter-statement whitespace per M1.01, not
emitted. Pairs with the missing-field deferral: a conditional whose
condition refers to a missing field renders the falsy branch (empty or
otherwise) silently in M1.12; the M1.11 missing-field error is
suppressed inside `(if ...)` because the conditional's job is to
guard against absence.

## Whitespace inside parens — `( if ... )` vs `(if ...)` (no PLAN.md entry — new I.review item)

All ten fixtures author the tight form `(if ...)`. The lexer must
decide whether `( if @x is true )` with internal spaces is the same
statement or just prose-with-parens.

**Concrete proposal:** rule (a) — `(if`, `(else)`, `(end)` are
recognised only when the opening `(` is immediately followed by the
keyword with **no intervening whitespace**. `( if @x )` parses as
literal prose `(`, the bare reference `@x`, and prose `)`. Rationale:
M1.05's `(name)` parameter form already locks "open-paren + identifier"
as a statement opener with no internal pad; carrying that discipline
into control keywords keeps one rule across the parens-family. The
trailing close-paren may or may not allow a pad (`(if @x )` — open
question for the reviewer, but tentatively also tight to mirror the
opener). Authors who want a literal `(if` in prose can use escape /
quote forms once those exist (deferred to later milestones).

## Nested-if classification — block vs inline (no PLAN.md entry — new I.review item)

`nested-ifs.wit` puts `(if b)` inside the body of `(if a)`. Two
readings: (a) `(if ...)` is always a block statement that may contain
other block statements as a body element; (b) the inner `(if b)` is a
distinct inline form embedded mid-prose, with different end-detection
rules from the outer.

**Concrete proposal:** rule (a) — exactly one form of `(if ...)`,
always block, always terminated by a matching `(end)` paired by
nesting depth (innermost-`(end)`-closes-innermost-`(if)`). The body of
an `if` is a sequence of body elements, where a body element is
either a chunk of prose or another block statement (a nested `if`, or
a future `each`). Rationale: a single form for both nested and
top-level `(if)` matches DS-11 ("`(if cond) ... (end)`") which makes no
positional distinction, and removes the need for a separate inline
classification. Pairing is structural (depth) rather than lexical
(nearest token), which makes `(if a) (if b) x (end) (end)` and
`(if a) (if b) x (end) y (end)` both unambiguous.

## May `(if ...)` appear inline mid-prose, or only as a block? (no PLAN.md entry — new I.review item)

Related to the nested-if question but distinct: when an `(if ...)`
opens after a prose token on the same line (not at the start of a
paragraph), is it the same construct, or restricted to "block start"
positions?

**Concrete proposal:** rule (a) — `(if ...)` is positionally free: it
may open anywhere a body element is legal, including mid-paragraph
after prose tokens, and its body / `else` / `end` flow through the
surrounding prose with their own paren-delimited boundaries. The
rendered output simply concatenates the chosen branch's body into the
prose stream. Rationale: Wit is prose-first and `(if ...)` is a
prose-embedded gate; forcing it to paragraph-start would surprise
authors who write "He stayed (if @lamp.flag) until dawn (end) and
left." The block / inline distinction is purely visual — the parser
sees one form. The fixtures in this category author mostly
paragraph-start `(if)` for clarity, but the parse rule should not
depend on column position. `(else)` and `(end)` likewise float;
matching is by depth, not by indentation.

---

Cross-cuts deferred to later milestones (informational, no
open-question status):

- `(each ...)` iteration: M1.13. `(each)` will reuse the same paren-
  delimited / `(end)`-closed shape; nesting `(if)` and `(each)` lives
  in `17-combinations/`.
- Comparison against a reference RHS (`@x is @y`) rather than a
  literal: out of scope. Only literal RHS authored here; reviewer
  may flag if a later milestone needs the reference-RHS form earlier.
- Missing-field-as-condition (`(if @nope)`): the M1.11 missing-field
  resolution-error rule is suppressed inside `(if ...)` per the
  truthy-semantics proposal above; the falsy branch is taken silently.
  Combined fixture lives in `17-combinations/`.
- `!!`-string operand on the RHS of comparison (`is !!draft`): deferred
  until `!!` semantics are unlocked outside definition values.
- `(else if cond)` chains: not in PLAN E.1; deferred until requested.
- Boolean connectives (`and` / `or` / `not`) inside conditions:
  deferred — DS-11 says "simple comparisons", which the fixtures here
  ratify as single-operator equality only.
