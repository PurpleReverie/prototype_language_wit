# 23-form-fill fixtures — authoring notes

Scope: M15.form-fill-and-colon-params. A NodeUse / NodeDef body is
classified as **form-fill** when its first non-blank, non-comment line
matches `^\s*<identifier>\s*:` followed by content. Every line of the
form-fill body is then `<key>:<value>` (with one optional leading space
trimmed from the value, trailing whitespace trimmed, comments / blank
lines ignored).

Form-fill is recognized in four positions:

- Template invocation body — `@x\n  k: v\nx@`. The use is rewritten as
  a self-closing record-arg-style call; `paramsSource = 'form-fill'`.
- Block-shape definition body — `#x\n  k: v\nx#`. The def collapses to
  a `DataDef` whose value is a `Record { k - v }`.
- Inline record literal `{ name: Tauraj, age: 31 }` — covered by item 2
  in the M15 brief (colon-as-separator); fixtures live in 09-records.
- Block record literal in a value-block def `#x:\n  k: v\n!!` — the
  body is form-fill; def collapses to `DataDef` with a record value.

Single-line bodies (e.g. `@x k: v x@`) do NOT trigger form-fill; the
strict colon-scatter rule (24-colon-scatter) applies instead.

Quoted-string values `"..."` may contain commas, newlines and other
special bytes. Only `\"` and `\\` escapes are recognized inside the
quotes.

Backslash escapes (`\:`, `\"`, `\\`, `\{`, `\}`) opt out of the colon
contract in prose. A line like `name\:Tauraj is bad` stays prose;
nothing is lifted.

## Fixture inventory

- `template-invocation.wit` — `@x` with form-fill body fills the
  template captures by field name.
- `block-record-def.wit` — `#x` with form-fill body collapses to a
  `DataDef` whose value is a record.
- `value-block-record-def.wit` — `#x:` followed by form-fill body and
  `!!` collapses to a `DataDef` (same as `#x: { k - v } !!` but the
  body is the unbraced form).
- `with-comments.wit` — `~ ...` lines interspersed are ignored.
- `with-quoted-string.wit` — a value contains a comma via `"..."`.
- `bibliography-style.wit` — the realistic bibliography use case
  motivating the milestone.
- `with-emphasis-in-value.wit` — values containing `_..._` / `*...*`
  emphasis markers and end-of-line italic survive as literal characters
  (M15.form-fill-fix regression: previously inline parsing ate them).

## Error fixtures

- `tests/errors/form-fill-malformed-line.wit` — a line that isn't a
  comment / blank / `<id>:<value>` after the first field surfaces
  `E_MALFORMED_FORM_FIELD`.
- `tests/errors/quoted-string-unterminated.wit` — a `"` with no
  matching close inside a record value surfaces `E_UNTERMINATED_STRING`.
