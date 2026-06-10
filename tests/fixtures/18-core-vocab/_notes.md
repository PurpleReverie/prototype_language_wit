# 18-core-vocab fixtures — authoring notes

## Reserved core-vocabulary node names (no PLAN.md entry — new I.review item)

These fixtures exercise the M10.core-vocab reserved set. The resolver
does NOT require a `#def` for any of these names; the renderers ship
explicit handlers that map them to semantic HTML / Markdown.

Categories covered:
- `headings.wit` — `@h1` through `@h3`
- `inline-marks.wit` — `@em`, `@strong`, `@code`
- `lists.wit` — `@ul` / `@li`
- `links-and-media.wit` — `@a`, `@img`, `@figure`, `@figcaption`
- `blocks.wit` — `@blockquote`, `@pre`, `@hr`
- `sectioning.wit` — `@article`, `@section`, `@header`, `@footer`

**Concrete proposal:** every name in `RESERVED_OPAQUE | CORE_VOCAB_NAMES`
(`packages/runtime/src/core-vocab.ts`) is bind-skip in the resolver and
gets a dispatch in `render-html/render-core-vocab.ts` /
`render-markdown/render-block.ts`. Reviewer: confirm the list is final
for v1.
