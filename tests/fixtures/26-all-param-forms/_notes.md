# 26-all-param-forms — cross-form invocation showcase

A single fixture proves that all six param-invocation forms parse against
the same template and bind by the same capture names. Not a unit probe —
those live in 06-parameters-pipes (pipes), 22-record-args (brace),
23-form-fill (form-fill body) and 24-colon-scatter (colon scatter on a
single-line body). This category is the equivalence proof.

## Fixture inventory

- `showcase.wit` — `#card ||title, status||` template invoked in every
  form. Forms exercised, in source order:

  1. Pipes with explicit `card@` close.
  2. Pipes scatter across a body with intervening prose, last-one-wins.
  3. Parens, space-separated key/value (self-closing).
  4. Parens, colon-separated key/value (self-closing).
  5. Record-arg, inline, hyphen separator (self-closing).
  6. Record-arg, inline, colon separator (self-closing).
  7. Record-arg, multi-line, hyphen separator.
  8. Form-fill body — one `key: value` per line.
  9. Form-fill body with a multi-line value (M16).
  10. Colon scatter on a single-line body.
  11. Colon scatter with a quoted multi-word value.
  12. Pipes with a trailing-`!` flag.
  13. Self-closing pipes form — placed last so the parser does not
      greedily bind it to a later `card@`.

## Ordering constraint (PLAN.md — pipes binding)

Pipes-form invocation with no `card@` on the same line greedily matches
the next `card@` in the file. The self-closing case (#13) therefore must
come after every body-form invocation; otherwise the parser would bind
#13 to the close of #8/#9.

Surface options for the reviewer:

- Document the binding rule and keep the ordering constraint.
- Tighten the pipes-form self-close to terminate at the next blank line
  or block boundary, removing the ordering hazard.
- Add an error fixture under `tests/errors/` covering the greedy-bind
  surprise.

Not committed here — the showcase respects the current rule by ordering.
