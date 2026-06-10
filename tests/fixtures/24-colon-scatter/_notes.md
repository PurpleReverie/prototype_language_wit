# 24-colon-scatter fixtures — authoring notes

Scope: M15.form-fill-and-colon-params item 4. Inside a NodeUse body
classified as prose (NOT form-fill), the parser tokenises prose runs
for `<id>:<v>` tokens following the **strict colon contract**:

- `<id>` = `[A-Za-z][A-Za-z0-9_-]*`
- `<v>`  =
  - bare scalar `[A-Za-z0-9_-]+`, OR
  - quoted string `"..."` (with `\"` / `\\` escapes), OR
  - inline emphasis `_..._` (Italic) or `*...*` (Bold), OR
  - any `@<id>...` node use — bare reference, parens-form, or
    block-shape (`@x body x@`).
- Zero whitespace anywhere in the token (including between `:` and the
  start of the value — `key: @x x@` stays prose).
- The byte immediately before `<id>` must NOT be a word char or `\`.

Matching tokens are lifted as scattered params (`paramsSource = 'pipes'`
to share the existing pipe-form code path — they behave identically,
just no surrounding `|...|` markers).

For node-shape values the scanner inspects the next AST sibling: when
the residual prose Text ends in `<id>:` and the next child is an
Italic / Bold / NodeUse, the sibling is spliced out and its raw source
slice becomes `Param.value` (a string, re-parsed inline at expand time
by the runtime).

Override rule: last-one-wins, mirroring pipe-form scatter (see
`tests/fixtures/06-parameters-pipes/last-one-wins.wit`).

Backslash escape: `\:` suppresses the contract. The author writes
`name\:Tauraj` to keep the colon literal. After lifting, the backslash
is stripped (`\:` → `:`) in the residual prose text.

## Fixture inventory

- `body-scatter-single.wit` — one `<id>:<v>` token in a body.
- `body-scatter-multi.wit` — multiple tokens interleaved with prose.
- `body-scatter-override.wit` — last-wins on duplicate name.
- `body-scatter-quoted.wit` — quoted-string value with spaces.
- `body-scatter-escape.wit` — `name\:Tauraj` stays prose; no lift.
- `false-positive-prose.wit` — `the variable name:Tauraj is bad`
  lifts the param. Documented sharp edge — fixture pins the current
  behavior.
- `body-scatter-node-value.wit` — closer-form node value
  (`key:@v body v@`).
- `body-scatter-self-closing-node-value.wit` — parens-form node value
  (`key:@x(arg good)`).
- `body-scatter-italic-value.wit` — italic emphasis as value
  (`key:_italic_`).
- `body-scatter-bold-value.wit` — bold emphasis as value
  (`key:*bold*`).
- `body-scatter-multiple-node-params.wit` — two node params side by
  side, both lift.
- `body-scatter-node-then-bare.wit` — mixed node and bare scalar.
- `body-scatter-override-with-node.wit` — last-wins when both are
  node-shape values.
- `body-scatter-space-after-colon-is-prose.wit` — `key: @v body v@`
  (space after `:`) stays prose; node is left in the body, no lift.
