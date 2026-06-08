# 11-data-access — author notes

Dot-access (`@x.y`, `@x.0`, `@x.y.z.w`) into records and collections.
Lands W6.5 / W6.6 / W6.7 and A4.1–A4.4 against DS-10. Records (M1.09)
and collections (M1.10) are the containers being read; this category
adds the *read path*, not new container shapes. Definitions (`#x: ...`)
and use-side `@x` are inherited verbatim from M1.07 / M1.09 / M1.10 —
the access fixtures simply extend `@x` with `.segment` chains.

Forbidden-token sweep (per pack section 2): no `<%` / `%>` template
forms (M1.04/M1.05 surface only — bare `@x.y` lives in plain prose
here), no `(if` / `(each` (M1.12 / M1.13), no `+#` partials
(M1.08 lives in record-RHS only and is irrelevant for read paths),
no `!!` outside definition values, no `_italic_` / `*bold*` as test
subject, no `reference` keyword (M1.14). Confirmed clean.

## Access-path legal positions (PLAN.md I.3)

All nine fixtures place `@x.y...` in **body prose** of a top-level
statement (the file body, not inside a definition `#name: ...` value).
PLAN.md I.3 asks where `@x.y` is legal: statements / params / body
prose. The fixtures here only ratify the body-prose position; the
statement-LHS and param-RHS positions live in `17-combinations/`
(`@figure(meta - @keeper.history)`) and in M1.12 / M1.13 (`(if @x.y
is ...)`).

**Concrete proposal:** rule (a) — `@x.y...` is a value-producing
expression legal in any position a bare `@x` reference is already
legal: body prose, param RHS (M1.05/M1.06), record-RHS (M1.09 9.D.2
deferred lean), collection-item (M1.10 cross-cut). LHS (definition
name) is excluded — `#x.y: ...` is nonsense. Rationale: dot-access is
the read form of a reference; if `@x` is a legal value-producing
token in position P, then `@x.y` is also legal in P with no separate
grammar. One rule, one resolver entry-point.

## Fuzzy match rule — snake / space / camel collapse (PLAN.md I.3)

`fuzzy-match-snake.wit` and `fuzzy-match-camel.wit` define a record
with key `years at post` (the canonical multi-word form from
M1.09's `multi-word-key.wit`) and access it as `@keeper.years_at_post`
and `@keeper.yearsAtPost` respectively. W6.7 / A4.1 / DS-10 require
that the three surface forms resolve to the same canonical key.

**Concrete proposal:** rule (a) — at resolution time, both the
record's stored key and the access path's segment are normalised to a
canonical key by: lowercasing; splitting on whitespace, underscores,
and camelCase boundaries; rejoining as space-separated lowercase
words. `years at post`, `years_at_post`, `yearsAtPost`, and
`Years At Post` all collapse to canonical `"years at post"`.
Rationale: matches DS-10 verbatim ("dot access supports fuzzy-matched
keys") and W6.7's author-facing promise. The normalisation happens
once at lookup; stored keys retain their authored form for round-trip
fidelity. Acronyms (`HTTPSPort` → `https port`) are a known edge case
deferred to combinations / review.

## Spaces in access path itself (no PLAN.md entry — new I.review item)

`fuzzy-match-spaces.wit` writes `@keeper.years at post` — three
whitespace-separated tokens after the dot. Two readings: (a) the
access path consumes `years`, then `at` and `post` are bare prose
words after the access expression ends; (b) the whole multi-word
phrase up to a prose-meaningful boundary is the segment, and the
fuzzy-match rule above normalises it.

**Concrete proposal:** rule (a) — a dot-segment is a single
identifier-shaped token terminated by whitespace, `.`, or any
prose-meaningful character. `@keeper.years at post` parses as
`@keeper.years` (which fails the fuzzy match against canonical
`"years at post"` because the segment normalises to `"years"`) plus
the prose `at post`. The access-path source is single-token-per-
segment; multi-word *stored* keys are reached via snake / camel / etc.
Rationale: the alternative requires the parser to know which trailing
words belong to the path versus the surrounding prose, which is
unrecoverable without a closing delimiter. M1.07 already locks
`@name` as identifier-shaped; `.segment` inherits the same shape.
This fixture is a probe to confirm that the spaces case fails
gracefully (or warns), not a positive test.

## Missing-field behaviour (PLAN.md I.3)

`missing-field.wit` accesses `@keeper.nonexistent` against a record
defining only `name`. A4.4 requires a clear error. Three readings:
(a) error at resolution (halts render); (b) null / empty string
substitution (render continues); (c) undefined sentinel passed to
the rendered output.

**Concrete proposal:** rule (a) — missing field is a resolution
error reported with the source span of the `.nonexistent` segment
and the list of keys actually present on the record (after fuzzy
normalisation). Rationale: A4.4 says "detect missing fields with a
clear error" — silent fallback violates that requirement. Wit's
authoring stance (M1.07 forward-reference lean, M1.09 trailing-comma
tolerance) is forgiving on syntax but strict on semantics — a typo
in an access path is a bug the author wants surfaced, not papered
over. Belongs in `tests/errors/` per DS-15 once error codes are
enumerated.

## Numeric vs named segment (PLAN.md I.3)

`index-access.wit` uses `@findings.0.claim` — segment `0` is a
numeric index into a collection, segment `claim` is a named field on
the record at index 0. The disambiguation is by **value-shape, not
syntax**: the resolver looks at what the parent value is at each
step. Same dot, same parse, different semantics chosen by the value
under it.

**Concrete proposal:** rule (a) — segment matching all-digits
(`^[0-9]+$`) is treated as a numeric index *if* the parent value is
a collection; otherwise it is a named-key lookup on a record (records
may have all-digit keys). Negative indices, floats, and trailing-zero
forms (`00`, `01`) are out of scope for this category. Rationale: the
ambiguity is only apparent — the parent's value-shape is always known
at resolution time. Matches DS-9 / DS-10 (collections indexed,
records keyed); no new syntactic distinction is needed. `findings.0`
on a record with key `"0"` resolves to that key; on a collection,
to item zero.

## Chained depth composition (PLAN.md I.3)

`deep-chain.wit` writes `@x.y.z.w` and `access-into-nested-record.wit`
writes `@keeper.history.years`. The composition rule: each segment
is resolved against the result of the previous segment, left-to-
right, with no depth bound beyond the implementation stack. Each
intermediate segment must yield a container (record or collection);
the final segment may yield any value.

**Concrete proposal:** rule (a) — left-to-right segment resolution,
no depth limit. Each non-terminal segment must resolve to a
container; resolving a non-terminal segment to a scalar is an error
(`@keeper.name.length` against `name - Stephen` errors because
`name` is a scalar). Fuzzy-match (above) applies at every named
segment; index-vs-name disambiguation (above) applies at every
segment. Rationale: matches A4.3 ("chain access `@x.y.z`") and
parallels nested-container traversal in every comparable language;
imposing a depth cap would surprise authors without a clear payoff.

## Access result type — record vs scalar (no PLAN.md entry — new I.review item)

A terminal segment may resolve to a scalar (`@keeper.name` →
`String("Stephen")`), a record (`@keeper.history` →
`Record{...}`), or a collection (`@findings` → `Collection[...]`).
What does the *renderer* do with each? Scalars stringify by their
M1.09-locked typing (Number / Bool / String). Containers have no
locked render form.

**Concrete proposal:** rule (a) — scalar results stringify via the
M1.09 typing rule (Number → decimal text, Bool → `true` / `false`,
String → verbatim). Container results (record / collection) at a
terminal position produce a **resolution error** ("cannot render a
record; access a field") rather than dumping a stringified
container. Rationale: the author who writes `@keeper` in prose
without a field is almost certainly making a mistake — the body of
a record has no canonical text form. The error directs them to
either `@keeper.name` or an explicit `(each)` (M1.13). Same surface
as the missing-field error; same span-reporting discipline. Belongs
in `tests/errors/` per DS-15.

---

Cross-cuts deferred to later milestones (no open-question status —
purely informational):

- `@x.y` on the LHS of mutation (`lh.set` family, PLAN.md I.10):
  out of scope per the task brief. Mutability deferred entirely.
- `@x.y` inside `(if ...)` / `(each ...)`: deferred to M1.12 / M1.13.
- `@x.y` inside a reference path (M1.14): deferred. The bare-reference
  inside record value lean from M1.09 9.D.2 will compose with this
  category in `17-combinations/`.
- Access into a param value (`@figure(meta - @keeper.history)`):
  deferred to `17-combinations/` per the M1.09 cross-cut note.
- Access producing a collection that is then iterated (`(each
  @findings as f)`): deferred to M1.13.
