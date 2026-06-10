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

## M16.multi-line-param-values fixtures

A `key:` with empty same-line value followed by deeper-indented lines
treats the indented block as the value. "Strictly deeper" means each
continuation line's leading whitespace **starts with** the key's
leading whitespace AND has at least one additional space/tab. The
outer-indent prefix is stripped from each line; the inner indent
beyond that prefix is preserved verbatim. Blank lines inside the
block are kept. Trailing blank lines on the whole value are stripped.

- `value-multi-line.wit` — `body:` followed by two indented content
  lines becomes a single multi-line value (E1).
- `value-multi-paragraph.wit` — indented block contains a blank line;
  the blank line is preserved in the value (E1 + paragraph break).
- `value-empty-then-next-field.wit` — `title:` followed by `body: ...`
  at the same indent → empty value, next field begins (E2).
- `value-indented-key-shape-is-content.wit` — `description:` followed
  by indented `year: 1942 ...` and `keeper: ...`. The indented `year:`
  reads as content, NOT a field (E4 — continuation wins).
- `value-block-end-by-dedent.wit` — `a:` followed by one indented line
  then a key at the original indent → dedent ends the value (E7 mixed
  indented-block + single-line fields in same body).

## Error fixtures

- `tests/errors/form-fill-malformed-line.wit` — a line that isn't a
  comment / blank / `<id>:<value>` after the first field surfaces
  `E_MALFORMED_FORM_FIELD`.
- `tests/errors/quoted-string-unterminated.wit` — a `"` with no
  matching close inside a record value surfaces `E_UNTERMINATED_STRING`.
