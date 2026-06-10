# 09-records fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: record literals `{ ... }` (DS-9). A record is a set of named
fields wrapped in braces; keys use the same `-` separator as
parameters (DS-6). Records appear as definition bodies (`#x: { ... }`)
in this category — collections (`[ ]`), records-in-params, and data
access (`@x.field`) are out of scope and live in later milestones.
Spec page 10 / example file `examples/10-records.wit`.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

M16.multi-line-param-values fixtures (block-form record indented
continuation — see notes after the inventory):

- `block-record-multi-line-value.wit` — `{ a:\n  multi\n  line\n  here\n, b - 2 }`
  with `a`'s value spanning several lines, terminated by the top-level
  `,` (E1 + E8).
- `block-record-multi-line-with-comma-terminator.wit` — `a:`'s indented
  block ends mid-line at the top-level `,` (E8).
- `block-record-multi-line-with-close.wit` — `a:`'s indented block ends
  at the matching `}` on a continuation line (E5).
- `quoted-string-multi-line.wit` — pins existing behaviour: `"..."`
  inside a record value spans newlines unchanged.

Fixture inventory:

- `inline-single-field.wit` — `#x: { a - 1 }`, the smallest
  non-empty record.
- `inline-multi-field.wit` — `#x: { a - 1, b - 2 }`, two
  comma-separated fields on one line.
- `multi-line-record.wit` — opening `{` on the definition line,
  indented body, closing `}` flush left.
- `nested-record.wit` — `#x: { a { b - 1 } }`, a record value
  containing a record value.
- `multi-word-key.wit` — `#tenure: { years at post - 31 }`,
  multi-word key probe.
- `multi-word-value.wit` — `#keeper: { name - Aldous Vane }`,
  multi-word unquoted value probe.
- `scalar-types.wit` — string, number, boolean values in one
  multi-line record.
- `trailing-comma.wit` — `#x: { a - 1, }`, trailing-comma probe.
- `empty-record.wit` — `#x: { }`, the empty-record probe.
- `comma-in-value.wit` — `#x: { msg - hello, world }`, comma
  appearing inside an unquoted value.

## Scalar type distinction (PLAN.md I.5)

Cross-refs: PLAN.md I.5, DS-9 / 9.U.5, 9.S.3,
`scalar-types.wit`, `inline-single-field.wit`,
`inline-multi-field.wit`.

- I.5 wording: "Numeric literals in records — distinguished type,
  or just strings?" 9.U.5 leans toward distinguished:
  `parseScalar("31")` returns Number, `parseScalar("true")`
  returns Bool, else String. 9.S.3 declares the value union
  `string | number | boolean | Record | Collection`. The
  fixtures probe the surface but the recogniser rule itself is
  unstated.
- Three candidate rules:
  (a) **eager type recognition** — the parser inspects each
      value's bytes after the `-` separator. If the bytes match
      a decimal integer (`^-?[0-9]+$`) or float regex, emit
      Number. If they match `true` / `false` (lowercase exact),
      emit Bool. Otherwise emit String. The 9.U.5 wording reads
      most directly as this.
  (b) **lazy / string-only at parse time** — every record value
      is a String at the AST level; type coercion happens at
      access time (DS-10) or in the renderer. Simpler parser;
      pushes the recogniser into a later stage. Loses the
      `Value` union exhaustiveness assertion in 9.S.3.
  (c) **annotation-driven** — values are strings unless tagged
      with a sigil (`#x: { count - n:31 }`). Adds new syntax
      PLAN.md does not authorise.
- **Concrete proposal:** rule (a). Matches 9.U.5 and 9.S.3
  literally; the parser already inspects the value bytes to
  detect the field terminator (comma or newline), so the
  recogniser cost is marginal. Boolean recognition is
  case-sensitive lowercase exact match — see "Boolean literal
  recognition" below. Not committed; surface at M1.review.
- Open under proposal (a): what counts as a number? Lean:
  signed decimal integer or signed decimal float (no
  scientific notation, no hex, no underscores). `0`, `-1`,
  `3.14`, `-0.5` parse as Number; `1e3`, `0x10`, `1_000`,
  `Infinity`, `NaN` parse as String. Not probed in this
  category — `scalar-types.wit` uses one positive integer
  (`2024`) only.
- Open under proposal (a): leading/trailing whitespace inside
  the value bytes — `{ a -  31  }`. Lean: trim whitespace
  before applying the recogniser; the trimmed bytes `31`
  parse as Number. Not probed.
- Open under proposal (a): the empty value case `{ a - }`.
  Lean: error at parse time (the `-` separator promises a
  value; empty value bytes are malformed). Not probed in this
  category.

## Record indentation (PLAN.md I.15)

Cross-refs: PLAN.md I.15, DS-9 / 9.U.2,
`multi-line-record.wit`, `scalar-types.wit`,
06-parameters-pipes/_notes.md (parameter indentation).

- I.15 wording: "Indentation in records / collections —
  required for multi-line or cosmetic?" The fixture
  `multi-line-record.wit` uses two-space indentation matching
  `examples/10-records.wit` style; the fixture probes the
  surface but the indentation rule itself is unstated.
- Three candidate rules:
  (a) **cosmetic indentation** — multi-line record bodies
      parse the same regardless of leading whitespace. The
      parser scans from the opening `{` to the matching
      `}`, treating newlines as field separators (parity
      with commas) and ignoring leading whitespace on each
      body line. `multi-line-record.wit` parses identically
      whether body lines are flush, two-spaced, or
      tab-indented.
  (b) **indentation required, minimum one column** — body
      lines must be indented past column zero. A flush-left
      body line is a parse error (probably read as
      "definition body ended early"). Catches the missing-
      indent typo; adds a rule the spec does not state.
  (c) **indentation must match opener column + N** — strict
      block-style indentation, like Python or YAML. Adds
      ceremony PLAN.md does not authorise.
- **Concrete proposal:** rule (a). The brace pair `{ ... }`
  is the structural boundary; whitespace inside the braces
  is for the reader. Newlines and commas are
  interchangeable field separators (see "Hyphen-separator
  parity" below for the field shape; newlines separate
  fields in multi-line bodies the same way commas do
  inline). Cosmetic indentation matches the body-slot
  treatment in 07-definitions (the multi-line value body
  has no required indent column). Not committed; surface
  at M1.review.
- Open under proposal (a): mixed inline + multi-line in one
  record body — `{ a - 1, b - 2,\n  c - 3 }`. Lean: legal,
  commas and newlines are both field separators. Not
  probed (the fixture is purely multi-line).
- Open under proposal (a): the closing `}` column. The
  fixture places it flush left to match
  `examples/10-records.wit`. Lean: any column legal under
  (a). A common style guide may emerge later but the
  parser does not enforce one.
- Open under proposal (a): blank lines inside a multi-line
  record body — `{ a - 1\n\n b - 2 }`. Lean: legal, blank
  lines are ignored (parity with prose paragraph rules in
  01-prose? Not obvious — record body is not prose).
  Not probed.

## Comma in unquoted record value (PLAN.md I.4)

Cross-refs: PLAN.md I.4, DS-9 / 9.U.1, 9.U.6,
`comma-in-value.wit`, `trailing-comma.wit`,
06-parameters-pipes/_notes.md (unquoted values).

- I.4 wording: "Parameter values — always unquoted, or
  quoted for special-char values?" Records use the same
  `-` separator as parameters; the comma question carries
  over because comma is the record field separator and
  also a legal character inside English-language prose
  values like `Hello, world`.
- Three candidate rules:
  (a) **comma always terminates the field** — under (a),
      `comma-in-value.wit` parses as `{ msg - hello, world }`
      → a record with two fields: `msg - hello` and a bare
      `world` that has no `-` separator. The second field
      is malformed and the parser errors. Authors must
      quote or escape commas in values: `{ msg - "hello,
      world" }` (introducing quoting syntax PLAN.md does
      not currently authorise).
  (b) **comma terminates only the last field at the brace
      level** — the parser scans values as "everything
      from after the `-` separator up to the next
      unbalanced `,` or `}` at the current brace depth."
      Under (b), `comma-in-value.wit`'s `hello, world`
      reads as one field because there is no `}` or
      sibling-comma to terminate. Subtle and likely
      surprising.
  (c) **comma always part of value unless a sibling field
      follows** — the parser looks ahead after a comma; if
      the next non-whitespace bytes match `key -` shape,
      the comma is a separator; otherwise it is value
      bytes. Powerful but breaks one-pass parsing.
- **Concrete proposal:** rule (a). Parity with the
  parameter-value rule that M1.05/M1.06 left open under
  I.4 (the parens fixtures show multi-word values via
  spaces — `dark slate` — but no commas inside values).
  The simplest, most predictable rule: comma is always a
  separator at the brace level. `comma-in-value.wit` is
  therefore an ERROR fixture under (a) — pin the
  diagnostic location at the bare `world` token. Future
  quoting syntax for special-char values is a separate
  M1.review item if PLAN.md I.4 lands as "quoted for
  special-char values." Not committed; surface at
  M1.review.
- Open under proposal (a): does this composition with
  trailing-comma parity (next section) — `{ msg - hello,
  world, }` — change anything? No: each comma is still a
  separator, so the parse is `msg - hello | world | `
  with the trailing empty field tolerated (see
  trailing-comma section) and the middle bare-word field
  still an error.
- Open under proposal (a): semicolon or other punctuation
  inside values. Lean: legal as bytes; only comma is the
  separator. Not probed.

## Hyphen-separator parity with M1.05/M1.06 (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6 (parameters), DS-9 / 9.U.1, 9.C.3,
05-nodes-parens/_notes.md (hyphen-multi-word-key),
06-parameters-pipes/_notes.md (hyphen-multi-word-key),
`multi-word-key.wit`, `multi-word-value.wit`,
`inline-multi-field.wit`.

- 05-nodes-parens and 06-parameters-pipes both probe the
  `key - value` shape inside parentheses and pipes. Record
  fields use the same shape — `key - value` separated by
  ` - ` (space-hyphen-space). The question carries over to
  the brace context: does record-field key/value parsing
  behave identically to param key/value parsing, or do
  records introduce a different rule?
- Three candidate rules:
  (a) **identical parser, identical rule** — the same
      key/value splitter used for `key - value` inside
      parens and pipes is used inside braces. Multi-word
      keys (`years at post - 31`) and multi-word values
      (`name - Aldous Vane`) parse the same way as in
      params. The separator is ` - ` (any amount of
      whitespace, at least one space, on each side of the
      `-`).
  (b) **records require quoted keys** — records are
      data-shaped (closer to JSON / TOML) so keys must be
      bare-identifier or quoted. Loses the multi-word-key
      ergonomic that `examples/10-records.wit` shows
      (`years at post - 31`).
  (c) **records introduce a different separator** — e.g.
      `:` instead of `-` for records. Forces authors to
      track two separators (params use `-`, records use
      `:`) for no clear benefit.
- **Concrete proposal:** rule (a). The spec consistently
  uses `-` as the key/value separator across parens,
  pipes, and braces; treating the brace context the same
  as the param context is the simplest mental model.
  Multi-word keys and values parse identically. Not
  committed; surface at M1.review.
- Open under proposal (a): the exact tokenizer for `key -
  value` — is it "split on first ` - ` (space-hyphen-
  space)" or "split on last ` - `" or "longest-match
  greedy"? Lean: first ` - ` (greedy on the key side
  fails when the value contains a literal `-`; greedy on
  the value side fails when the key contains a literal
  `-`; the spec does not currently authorise either).
  06-parameters-pipes/_notes.md flagged the same
  literal-hyphen question under DS-6 territory. Not
  re-probed here; record fixtures inherit whatever rule
  lands for params.
- Open under proposal (a): is `key-value` (no spaces
  around `-`) the same as `key - value`? Lean: no. The
  separator is ` - ` exactly (at least one space on each
  side); `key-value` parses as a single bare token
  (probably a key with no value, which is an error).
  Parity with the param rule but not probed here.

## Trailing-comma parity with M1.05 (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-9 / 9.U.6,
05-nodes-parens/trailing-comma.wit,
05-nodes-parens/_notes.md, `trailing-comma.wit`.

- 9.U.6 wording: "Trailing comma tolerance — works in both
  records and collections." 05-nodes-parens already pins
  trailing-comma tolerance for parameter lists; records
  inherit the same surface (`#x: { a - 1, }`).
- Three candidate rules:
  (a) **tolerated, identical to param trailing comma** —
      a trailing `,` before `}` is legal and produces no
      empty field. Parity with 05-nodes-parens; the rule
      is "comma-separated list with optional trailing
      comma." 9.U.6 reads as this.
  (b) **error** — strict, no trailing comma. Catches
      typos at the cost of removing the diff-friendly
      pattern that motivated trailing commas elsewhere.
  (c) **tolerated, produces an empty field** — the
      trailing comma is honoured as a separator and the
      record gains a sentinel empty field. Surprising;
      breaks 9.S.1's `fields: { key, value }[]` shape
      because the trailing entry has no key.
- **Concrete proposal:** rule (a). 9.U.6 is explicit;
  this fixture pins the surface. Parity with M1.05's
  param trailing-comma rule. Not committed; surface at
  M1.review.
- Open under proposal (a): double trailing comma `{ a -
  1,, }`. Lean: error (an empty field between the two
  commas violates the `key - value` shape). Not probed.
- Open under proposal (a): trailing comma in a multi-line
  record where the last field uses newline-separation
  rather than comma — `{\n  a - 1\n  b - 2,\n}`. Lean:
  legal under (a); the `,` after the last field is the
  trailing-comma tolerance. Not probed.

## Empty record semantics (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-9 / 9.C.4, 9.S.1,
`empty-record.wit`.

- 9.C.4 wording: "Empty record / collection — `{ }`, `[ ]`
  are legal." Fixture pins the surface. Question: does the
  parser produce a `Record { fields: [] }` or refuse?
- Three candidate rules:
  (a) **legal, empty fields list** — `{ }` parses as
      `Record { fields: [] }`. Matches 9.C.4 directly;
      authors can declare a placeholder record and
      contribute fields later (interaction with additive
      partials is M1.08 territory but the empty-record
      base is the natural extension).
  (b) **legal only with whitespace** — `{ }` (with
      interior space) is legal; `{}` (no space) is an
      error. Adds a typographic rule with no semantic
      payoff.
  (c) **error** — empty records are forbidden; authors
      must declare at least one field. Loses the
      placeholder pattern.
- **Concrete proposal:** rule (a). 9.C.4 says `{ }` is
  legal; the parser produces `Record { fields: [] }`.
  Whether the bytes are `{}`, `{ }`, `{   }`, or
  `{\n}` makes no semantic difference — all parse to the
  same empty-fields record. Not committed; surface at
  M1.review.
- Open under proposal (a): rendering distinction between
  an empty record and a missing record. The renderer
  receives `Record { fields: [] }` either way; downstream
  code may want to distinguish "declared empty" from
  "never declared." Not probed (M4 renderer territory).
- Open under proposal (a): empty-record as the body of a
  definition that is then extended additively (M1.08
  `+#x: { ... }`). Composition unprobed; lean: the empty
  base contributes zero fields, additives append their
  fields. Not probed here.

## Nested well-nesting / adjacent `}}` whitespace (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-9 / 9.C.1, 9.S.3,
`nested-record.wit`.

- 9.C.1 wording: "Nested records — record inside record
  parses correctly." `nested-record.wit` probes
  `#x: { a { b - 1 } }`. Note the inner field uses bare
  `a { ... }` (key followed by a brace-record value with
  no `-` separator), matching `examples/10-records.wit`'s
  `history { years - 31, incidents - 2 }` pattern.
- Three candidate rules for nested-record value shape:
  (a) **brace value implies no separator** — when a field's
      value is itself a brace-record (or any structural
      literal), the `-` separator is omitted. `a { b - 1 }`
      reads as field `a` whose value is the nested record
      `{ b - 1 }`. Matches the example file directly.
  (b) **separator always required** — `a { b - 1 }` is an
      error; authors must write `a - { b - 1 }`. Loses the
      example file's ergonomic.
  (c) **either form accepted** — `a { b - 1 }` and
      `a - { b - 1 }` both legal, parser normalises. Adds
      surface variation for no clear payoff.
- **Concrete proposal:** rule (a). The `-` separator
  exists to delimit a key from an unquoted scalar value
  where the value boundary is otherwise ambiguous. A
  brace-record value is self-delimiting (the matching
  `}` ends the value), so the `-` becomes redundant.
  Parity with the example file. Not committed; surface
  at M1.review.
- Adjacent close braces `}}` (no whitespace between) at
  the end of `nested-record.wit` probe the
  brace-balancing scan. Lean: legal, the parser tracks
  brace depth and pops twice. Whitespace between the
  inner and outer `}` is cosmetic only. Not probed in
  isolation (the multi-field inline equivalent
  `{ a { b - 1 }}` would also be legal under (a)).
- Open under proposal (a): how deep can nesting go?
  Lean: unbounded structurally, limited by parser stack
  in practice. No fixture probes deep nesting.
- Open under proposal (a): mixed nested + flat fields —
  `{ a - 1, b { c - 2 } }`. Lean: legal, field `a` uses
  the scalar form and field `b` uses the brace form.
  Not probed.

## Boolean literal recognition (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-9 / 9.U.5, 9.S.3,
`scalar-types.wit`, `multi-line-record.wit`.

- 9.U.5 wording: "`parseScalar("true")` Bool." The
  fixture `scalar-types.wit` uses `final - true`;
  `multi-line-record.wit` uses `lamp lit - true`.
  Question: which bytes count as Bool?
- Three candidate rules:
  (a) **lowercase exact, two literals only** — `true`
      and `false` (and nothing else) are recognised as
      Bool. `True`, `TRUE`, `yes`, `1`, `on` parse as
      String (or, in the case of `1`, Number).
  (b) **case-insensitive** — `true`, `True`, `TRUE`,
      `false`, `False`, `FALSE` all parse as Bool.
      Friendlier to authors; loses parity with
      common-language rules.
  (c) **extended truthy set** — `yes`/`no`, `on`/`off`,
      `1`/`0` also recognised. Powerful but
      surprising; conflicts with Number recognition
      (`1` would be Bool or Number?).
- **Concrete proposal:** rule (a). Parity with most
  programming languages and with JSON; the parser's
  recogniser stays simple. Authors who want "yes" /
  "no" semantics get strings; the renderer (or DS-13
  scripts) can map them. Not committed; surface at
  M1.review.
- Open under proposal (a): boolean recognition scope —
  does the rule apply only inside record values, or
  also inside parameter values? Lean: record values
  only. Param values are strings unless I.5 lands more
  broadly. The hyphen-separator-parity proposal above
  pushes for consistency between param and record
  key/value tokenization, but value-type recognition is
  not the same as key/value tokenization — params stay
  string-only at parse time. Not probed.
- Open under proposal (a): `true` or `false` as a record
  KEY rather than value. Lean: legal as a bare-word
  key (`{ true - 1 }`). The recogniser only inspects
  values (bytes after `-`). Not probed.

## String values with reserved chars (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md I.4, DS-9 / 9.U.5,
`multi-word-value.wit`, `scalar-types.wit`,
06-parameters-pipes/multi-word-value.wit.

- `multi-word-value.wit` probes `{ name - Aldous Vane }`;
  `scalar-types.wit` probes `title - Q3 Operations
  Review`. Question: which bytes are legal inside an
  unquoted string value?
- Three candidate rules:
  (a) **anything-but-separator** — the value bytes
      extend from the first non-whitespace after `-`
      to the next field separator (comma at brace
      level, newline in multi-line bodies, or matching
      `}`). All other bytes are value content,
      including digits, punctuation (except `,`),
      capitals, and Unicode. Number / Bool recognition
      runs over the trimmed bytes; non-matches are
      String.
  (b) **identifier-only without quotes** — multi-word
      values like `Aldous Vane` require quoting; bare
      values must match a single-token identifier
      regex. Loses the example file's ergonomic.
  (c) **explicit quote opt-in** — quoting introduced
      for values containing reserved chars (`,`,
      newline). PLAN.md I.4 leans toward this but
      defers it.
- **Concrete proposal:** rule (a). Matches the example
  file directly and parity with M1.05/M1.06 param
  values (`background colour - dark slate`). The
  comma-in-value error fixture pins where the
  "anything-but-separator" rule breaks down (commas
  are separators); future quoting (I.4) would extend
  the rule but not replace it. Not committed; surface
  at M1.review.
- Open under proposal (a): leading/trailing whitespace
  inside the value bytes — trimmed before type
  recognition (see "Scalar type distinction"). The raw
  bytes between the `-` separator and the next field
  boundary are stripped of surrounding whitespace
  before storage. Not probed.
- Open under proposal (a): values containing braces —
  `{ a - hello {world} bye }`. Lean: legal as raw
  bytes only if brace balancing inside the value is
  not enforced; conflicts with the nested-record rule
  (a) above which interprets a brace as a structural
  literal. Resolution: a brace immediately following a
  key (with no `-`) is a nested record; a brace inside
  a value (after a `-`) is value bytes. Not probed.
- Open under proposal (a): Unicode in values — e.g.
  `name - Mara Finch — author`. Em-dash in the value
  bytes, indistinguishable from the surrounding ASCII
  context. Lean: legal under (a). Not probed.

## Record-in-param out-of-scope note (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-6, DS-9, 06-parameters-pipes/_notes.md.

- This category probes records as definition bodies
  only (`#x: { ... }`). The composition where a record
  appears as a parameter value — `@figure(meta - { a -
  1 })` or `@figure |meta - { a - 1 }|` — is not
  probed. PLAN.md does not currently call this out.
- Three candidate rules:
  (a) **records-in-params legal, deferred** — the
      brace-value form is legal anywhere a value is
      expected, including param values. Not probed
      here; lands when a later M1 milestone (or M2
      parser work) exercises the composition.
  (b) **records-in-params forbidden** — record
      literals only appear in definition bodies.
      Param values stay scalar / multi-word string.
      Loses a useful pattern (metadata passed
      inline).
  (c) **records-in-params via additive composition
      only** — authors must declare a named record
      definition (`#meta: { a - 1 }`) and pass the
      handle (`@figure(meta - @meta)`). Adds
      ceremony.
- **Concrete proposal:** rule (a). Defer the
  composition probe to a later category (likely
  17-combinations or a dedicated M1.review item).
  The brace literal's grammar is the same wherever it
  appears; what differs is which contexts accept a
  brace value, and that question belongs with each
  context's category. Not committed; surface at
  M1.review.
- Open under proposal (a): the value-tokenizer in
  param context (06-parameters-pipes) currently reads
  "anything-but-comma-or-close-paren" — would it
  recognise `{` as the start of a brace value and
  switch to brace-balancing mode? Lean: yes under (a),
  but the rule lands as part of the param-value
  recogniser, not the record literal grammar. Not
  probed.
- Open under proposal (a): records-in-pipes specifically
  — `|meta - { a - 1 }|`. Same question; same lean.
  Not probed.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single
  trailing LF. No CR/LF or BOM variants; byte-level
  probes live in 00-lexical.
- Not probed in this category and deferred:
  - records as parameter values (see record-in-param
    section above);
  - records inside collections (M1.10 / 10-collections
    territory; covered by 9.C.2);
  - data access into record fields — `@keeper.name`,
    `@x.a.b` — lives in M1.11 / 11-data-access;
  - record values that reference other definitions —
    `{ link - @other }`. Lean: bare-reference inside
    a value follows the I.6 boundary rule. Not
    probed;
  - record field with no value (`{ a }`) or no key
    (`{ - 1 }`). Lean: error in both cases. Not
    probed;
  - record bodies containing comments (`~ ...` or
    `~~ ... ~~`). Lean: legal, comments are elided
    before field tokenization. Not probed;
  - very large records (thousands of fields). DS-17
    territory; not probed;
  - records with reserved-word keys — `{ if - 1,
    each - 2 }`. Lean: legal as keys (no reserved
    words at the key level in DS-9); conflicts may
    arise once DS-11/DS-12 land. Not probed;
  - duplicate keys in the same record — `{ a - 1,
    a - 2 }`. Lean: error or last-one-wins; parity
    with the M1.06 last-one-wins param rule pulls
    last-wins but the data-shape context pulls
    error. Not probed.
