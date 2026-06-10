# 22-record-args fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — surface at review.

Scope: M13.records-as-args. A record literal `{ key - value, ... }`
appearing immediately after a NodeOpen handle (with optional
whitespace between handle and `{`) becomes the call-site arguments
for that node use. The fields are bound by name into the template's
captures. This category is the use-side. The record literal grammar
itself is unchanged — it's the same scanner that parses single-line
def bodies (`tests/fixtures/09-records/`).

Surface form:
```
@reference_entry { author - Boud, D., year - 2001 }
```
Or, across lines:
```
@reference_entry {
  author - Boud, D.
  year - 2001
}
```

The brace `{` may appear immediately after the handle or after one
or more spaces. Self-closing: the matching `}` ends the call. No
`name@` body close, no `!!` short-close.

Narration discipline: per `tests/fixtures/README.md`, narration is
forbidden from `03-comments/` onward. Every fixture in this directory
was authored with NO narration line.

## Why the brace-after-handle form (PLAN — M13)

The motivation is template invocations with several named params.
Today the choices are:

- positional `||a, b, c||` capture list with positional values via
  parens — works only when the author remembers the declared order;
- explicit pipe-form `|key value|` — one slot per line, verbose;

The record-arg form `@name { key - value, ... }` reuses the existing
record literal as a named-argument carrier. Field name → capture name.
No new sub-grammar; one new parse rule (peek for `{` after the
handle).

## Mixing rule (v1, conservative)

Record-arg may NOT combine with pipe-form `|...|` or parens-form
`(...)` on the same call. Mixing → `E_MIXED_PARAM_SOURCE`. The error
fixture lives at `tests/errors/mixed-pipe-and-record.wit`.

Record-arg may NOT combine with a `... name@` body. The record-arg
call is self-closing by construction. The matching `}` already
ended the call; any trailing `name@` would dangle. Not probed in
this category (the parser simply produces a self-closing NodeUse and
leaves any subsequent `name@` for the surrounding grammar to
diagnose as a stray close).

## Resolution rule

The template's captures are computed exactly as today: either the
explicit `||captures||` list, or inferred from `::name::` occurrences
in the body (M10.core-vocab Thread 1, see `parser-captures.ts`).

For each capture, the resolver looks up `record.field[name]`.

- Missing field → `E_MISSING_RECORD_FIELD` with the field name and
  template handle.
- Extra field (not declared by the template) →
  `E_EXTRA_RECORD_FIELD` with the field name.

Number / bool scalars in the record stringify at interpolation time
(matches today's behavior for positional captures).

## Fixture inventory

- `inline-single-field.wit` — `@x { a - 1 }`, smallest viable case.
- `inline-multi-field.wit` — `@x { a - 1, b - 2 }`, two fields
  comma-separated on one line.
- `multi-line-record.wit` — bibliographic-style record across many
  lines. Demonstrates the citation use-case the brief motivates.
- `template-expansion.wit` — `#tpl: ||a, b|| ::a:: + ::b:: !!` then
  `@tpl {a - 1, b - 2}`. Snapshot is the AST; the expander then
  renders `1 + 2`.
- `template-implicit-captures.wit` — `#tpl: hello ::name:: !!` with
  no explicit `||name||`, then `@tpl {name - world}`. Captures are
  inferred from `::name::`; the record-arg binds by name.

## Open under proposal (a) — record-arg + body via separate node

The brief states record-arg is strictly self-closing. The natural
question: is `@x { a - 1 } body x@` legal? Lean no — `}` already
closed the call. The `body x@` is two things: prose then a stray
close. Not probed here; would belong in `tests/errors/` once we
commit on the exact diagnostic.

## Open — record-arg with access path `@x.field { ... }`

The lexer scans the access path before the brace. Per current
shape detection, access-path forms are always bare references and
never carry params. The brace after `@x.y` is therefore consumed
as a record-arg but never used (the NodeUse becomes a bare access).
Lean: at minimum, the parser should diagnose this — record-arg has
no meaning on a data-access. Not probed; surface at review.

## Inherited limitation — commas inside unquoted values

The record-arg surface inherits the entire `tryParseRecordFromText`
scanner from `09-records/`. That scanner treats a comma at brace
depth 0 as a field separator (rule (a) under "Comma in unquoted
record value" in 09-records/_notes.md), which the brief's
bibliographic example trips over: `author - Boud, D.` is parsed as
field `author = Boud` followed by a bare `D.` (no key separator,
error).

The fixture `multi-line-record.wit` therefore uses comma-free values
(`author - Boud` instead of `Boud, D.`). The realistic citation use
case the M13 brief describes (`Boud, D.` author, `2001(90), 9-18`
publisher) is currently **unauthorable in v1 record-args** without a
quoting mechanism the wider record grammar does not yet have.

Surface options for the reviewer:
- adopt the quoting form already deferred under PLAN.md I.4 (e.g.
  `{ author - "Boud, D." }` or `{ author - !Boud, D.! }` reusing
  the bang-value syntax from `10-collections`);
- treat unquoted record values as "anything but newline / matching
  brace," dropping comma as a field separator — would require a
  parallel update to `09-records/` semantics;
- mark this as a known M13 surface hole, push the bibliographic use
  case to a follow-up milestone.

Not committed here — M13 only adds the brace-after-handle parse
rule, not new value-tokenization rules.

## File-edge cases deferred

- Every fixture in this directory ends with a single trailing LF.
- Empty record-arg `@x {}` — under M13 v1, this is treated like
  `@x` with no params (record with zero fields → no captures
  bound). Not probed; surface at review.
- Record-arg with nested record value (`@x { meta { a - 1 } }`) —
  the value-side scanner handles this naturally (records-in-records
  is already supported in 09-records). Stringification at
  interpolation time JSON-serializes the nested value. Probably
  not the intended use; surface at review.
