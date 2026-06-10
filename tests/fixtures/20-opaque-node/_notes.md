# 20-opaque-node fixtures — authoring notes

## `@node` reserved opaque container (no PLAN.md entry — new I.review item)

`@node` is reserved at the resolver level (M10.core-vocab Thread 2).
The resolver does not require a `#def` for `node`; the expander passes
the invocation through intact, with all params travelling on the AST.

Patterns:
- `bare-node-passthrough.wit` — `@node(type X)` self-closing form.
- `node-with-body.wit` — `@node ... node@` block form.
- `user-defined-wrapper.wit` — `#highlight` template wrapping `@node`,
  giving the writer a natural name while the AST carries `type highlight`
  for the renderer to dispatch on.

**Concrete proposal:** renderers dispatch on the `type` param. If
`type` matches a core-vocab name, route to that handler; otherwise
emit a generic container with all params as `data-*` attributes (HTML)
or just emit the body (Markdown — no opaque container exists).
