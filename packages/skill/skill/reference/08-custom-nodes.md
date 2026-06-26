# Custom nodes — formatting beyond core HTML/Markdown

Authors using Wit on a project with a custom renderer can reach for
formatting the standard HTML/Markdown vocabulary doesn't cover —
callouts, math, diagrams, marginalia, drop caps, footnotes, charts.
Implementers building a renderer can add these by dispatching on
opaque-node `type`.

This file is the catalog of common extensions plus the shape both
sides should use. For the renderer API itself (parser/runtime
imports, walking the AST), see
[`06-custom-renderers.md`](./06-custom-renderers.md).

## The `@node(type X)` extension point

Wit reserves `@node` as an opaque pass-through container. Required
param: `type`. Any other params and the body are kept intact in the
expanded AST. The reference renderers emit a passthrough element for
unknown types so custom renderers stay backward-compatible.

```
@node(type custom_thing, layout horizontal)
Body content the consumer renderer dispatches by type.
node@
```

The renderer reads `expanded.params.type` and emits whatever the
target format wants. Other params are extras the type's renderer
branch knows about.

## Wrap `@node(type X)` in a def — make your own types

Writing `@node(type callout, tone info)` over and over is repetitive
and easy to typo. The preferred authoring pattern is to **wrap each
custom type in a block-form def** and call that def by name. The
project gets its own first-class node types — `@info`, `@warn`,
`@figure` — that happen to expand to `@node(type X)` calls.

This is the same `#name … name#` block-form def from
[`02-defs-and-captures.md`](./02-defs-and-captures.md), used with body
splice `...` to forward the invocation's body into the inner
`@node` call.

### Pattern A — no-param wrapper

Fixed type, fixed extras, body splices in via `...`.

```
#info
@node(type callout, tone info)
...
node@
info#

@info
The lamp's second-order Fresnel lens was installed in 1857.
info@
```

The author writes `@info … info@`; the parser expands it to
`@node(type callout, tone info) … node@`. The renderer sees the same
opaque node it would have seen from the unwrapped call.

### Pattern B — a family of related wrappers

Define one per variant. Authors get a clean type vocabulary instead
of remembering which `tone` value goes with which surface.

```
#info
@node(type callout, tone info)
...
node@
info#

#warn
@node(type callout, tone warn)
...
node@
warn#

#error
@node(type callout, tone error)
...
node@
error#

#tip
@node(type callout, tone tip)
...
node@
tip#
```

Now the document reads:

```
@info Do not service the lamp during fog conditions. info@
@warn Bell rope frays under sustained tension. warn@
@error The keeper failed to log the bell signal. error@
@tip Use the inner cleat for the relief line. tip@
```

Five-character calls, no repeated `type` param, no chance of typoing
`warn` as `warning`. The defs are usually grouped in a project-wide
`shared/types.wit` and pulled in via `reference` (see
[`10-document-assembly.md`](./10-document-assembly.md)).

### Pattern C — wrapper that forwards params

Captures forward into the inner `@node` call.

```
#figure ||src, id||
@node(type figure, src ::src::, id ::id::)
...
node@
figure#

@figure |src plates/dunmore.jpg| |id fig_dunmore|
Dunmore Head lighthouse, view from the cove at dawn.
figure@
```

The capture interpolates into the inner node's param list at expand
time. The renderer's `figure` branch sees `params.src`,
`params.id`, and the caption body — exactly the same shape it would
see from the raw `@node(type figure, src plates/..., id fig_...)`
call.

### Pattern D — wrapper that mixes constants and params

Useful when most params are fixed and only one varies.

```
#math_block ||expr||
@node(type math, display block)
::expr::
node@
math_block#

#math_inline ||expr||
@node(type math, display inline) ::expr:: node@
math_inline#

@math_block |expr - \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}|

The Gaussian integral, @math_inline |expr e^{i\\pi} + 1 = 0|.
```

### Why this is the preferred pattern

- **Less repetition** — the type param lives in one place.
- **Refactorable** — change the underlying `@node(type X)` once;
  every call site updates. Renaming `callout` to `notice` in the
  renderer? Edit four defs. The prose doesn't change.
- **Self-documenting** — `@info … info@` reads naturally. `@node(type
  callout, tone info)` doesn't.
- **Discoverable** — the project's wrapper defs are the catalog of
  what this project's renderer supports. New authors read
  `shared/types.wit` and know exactly what they can use.
- **Composable** — wrappers are first-class defs; you can capture,
  splice, and reference them like any other node.

### A note on graceful degradation

A renderer that doesn't know about a custom `type` still receives the
expanded `@node(type X)` call and emits a passthrough placeholder.
Wrapper defs preserve this — the inner call is unchanged. So a
document using `@info @warn @figure` shapes can still render in a
fallback renderer that only understands core vocab; the bodies
survive even when the styling doesn't.

## Catalog of common extensions

The catalog below shows the underlying `@node(type X)` shapes. **In
real documents you'll wrap each in a def** (see the section above) so
the type param isn't repeated. The raw shapes here are what the
wrappers expand to and what the renderer dispatches on.

### Callouts — info / warn / error / tip

The most common extension. Boxed prose with an icon and tone-colored
border.

```
@node(type callout, tone info)
The lamp's second-order Fresnel lens was installed in 1857.
node@

@node(type callout, tone warn)
Do not service the lamp during fog conditions.
node@

@node(type callout, tone error)
The keeper failed to log the bell signal.
node@
```

Renderer sketch (HTML): emit `<aside class="callout callout--{tone}">`
with an icon prefix derived from `tone`.

### Math — LaTeX bodies via MathJax / KaTeX

```
@node(type math, display block)
\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}
node@

Inline math: @node(type math) e^{i\pi} + 1 = 0 node@.
```

Renderer sketch (HTML): pass the body verbatim into a `<span>` or
`<div>` with class `math` plus a `display` attribute; client-side
MathJax/KaTeX renders it.

### Diagrams — Mermaid, Graphviz, PlantUML

The body is opaque source code for an external tool that renders to
SVG.

```
@node(type diagram, engine mermaid)
graph LR
  A[Source] --> B(Parse)
  B --> C(Resolve)
  C --> D(Expand)
  D --> E[Render]
node@

@node(type diagram, engine graphviz)
digraph G { rankdir=LR; A -> B -> C; }
node@
```

Renderer sketch: write body to temp file, shell out to `mmdc` /
`dot` / `plantuml`, inline the resulting SVG.

### Code blocks with annotations

```
@node(type code, lang typescript, annotate true)
export function resolve(ast: Document, opts: ResolveOptions) {
  const root = opts.rootPath;          // ◀ note 1
  return walk(ast, root);              // ◀ note 2
}
node@

@node(type code_notes)
1. The resolver entry point.
2. Recursive descent over the AST.
node@
```

Renderer sketch: syntax-highlight via Prism/Shiki; parse `◀ note N`
markers; group them with the adjacent `code_notes` block into a
side-by-side layout.

### Footnotes & endnotes

Auto-numbered, back-linked.

```
The lamp burned for eleven days@node(type footnote)
See the keeper's log, entry of 14 March 1857.
node@ before any keeper noticed.
```

Renderer sketch: collect every `footnote`-typed node during walk;
emit a numbered superscript link in place; emit the body in an
endnotes section at the end of the document with backref anchors.

### Marginalia / sidenotes

Notes that float in the page margin alongside the paragraph they
reference. Common in Tufte-style layouts.

```
The Fresnel lens
@node(type margin)
The lens was named for Augustin-Jean Fresnel, 1788–1827.
node@
focuses light through concentric prisms.
```

Renderer sketch (HTML): emit `<aside class="margin-note">` with CSS
positioning; degrade to footnote in Markdown.

### Drop caps

A large first letter at the start of a chapter.

```
@node(type drop_cap)
F
node@or eleven days the lamp had burned untended.
```

Renderer sketch (HTML): emit `<span class="drop-cap">F</span>`;
Markdown drops the wrapper, plain text remains.

### Pull quotes

Emphasized quote in larger type, often pulled out beside the prose.

```
@node(type pull_quote, attribution Weil)
Attention is the rarest form of generosity.
node@
```

Renderer sketch (HTML): `<blockquote class="pull">` with the
attribution as a `<cite>`.

### Figures with captions and auto-numbering

Beyond what core `@table` covers — pictures, schematics, plates.

```
@node(type figure, src ./plates/dunmore-head.jpg, id fig_dunmore)
Dunmore Head lighthouse, view from the cove at dawn.
node@

… as Figure @node(type figref, target fig_dunmore) node@ shows …
```

Renderer sketch: maintain a counter while walking; rewrite each
`figref` to "Fig. N" referring to the matching `id`.

### Charts / data visualizations

The body is structured data for a charting library.

```
@node(type chart, kind bar, x_axis quarter, y_axis revenue)
{ quarter - Q1, revenue - 42 }
{ quarter - Q2, revenue - 51 }
{ quarter - Q3, revenue - 47 }
{ quarter - Q4, revenue - 58 }
node@
```

Renderer sketch: parse the body as a Wit collection (re-use the
parser via `lh.data`-style indirection or a separate call), pass to
Chart.js/Vega-Lite, emit `<canvas>` or `<svg>`.

### HTML-specific interactive widgets

```
@node(type collapsible, title Details)
Hidden behind a disclosure triangle.
node@

@node(type tabs)
@node(type tab, label Source) source.wit content node@
@node(type tab, label Output) rendered output node@
node@
```

Renderer sketch (HTML): emit `<details><summary>…</summary>` or a
tablist with ARIA roles. In Markdown, render as plain prose with a
heading per tab.

### Print-specific directives

```
@node(type page_break)
node@

@node(type column_break)
node@
```

Renderer sketch (HTML for print): emit `<div style="page-break-after:
always">`. Markdown / web HTML: ignore.

### Glossary terms (auto-cross-linked)

```
The @node(type term, target fresnel) Fresnel lens node@ focuses light…
```

Renderer sketch: maintain a `#glossary` collection of definitions;
every `term` node becomes a tooltip or link pointing at the matching
definition entry.

## Extending a renderer with a new type

The full API surface is in
[`06-custom-renderers.md`](./06-custom-renderers.md). The minimal
recipe is:

```ts
function renderNode(node) {
  if (node.kind !== 'node') return defaultRender(node);
  const type = node.params.type;
  if (type === 'callout')   return renderCallout(node);
  if (type === 'math')      return renderMath(node);
  if (type === 'diagram')   return renderDiagram(node);
  // … one branch per supported type
  return passthrough(node);   // unknown types fall through
}
```

Keep the default `passthrough` — unknown `@node(type X)` calls should
emit a faithful placeholder rather than throwing. That way authors
can write the same source for multiple renderers and degrade
gracefully when a target doesn't implement a given type.

## Authoring tip — portable vs renderer-specific

When the same `.wit` source needs to render across multiple targets
(GitHub Markdown, a custom HTML site, a PDF), every `@node(type X)`
call is a compatibility decision.

**Portable shapes** (always work):

- Core vocab: `@h1`–`@h6`, `@em`, `@strong`, `@ul`, `@ol`, `@li`, `@a`, `@table`.
- Custom defs via `#name … name#` or `#name: … !!` — these expand to
  core vocab and prose, so they render anywhere.

**Target-specific shapes** (`@node(type X)`):

- Use only where the target renderer supports the type, OR where
  graceful degradation to a passthrough is acceptable.
- **Always wrap them in a def** (see [Wrap `@node(type X)` in a def
  — make your own types](#wrap-nodetype-x-in-a-def--make-your-own-types)).
  The wrapper itself is portable; only the inner expansion is
  renderer-specific, and the passthrough rule keeps the body visible
  in any target.

### Project shape — `shared/types.wit`

Group your project's wrapper defs in a single file pulled in via
`reference`. This becomes the catalog of node types authors in the
project can use.

```
~ shared/types.wit — every custom node type the project supports.

~ Callouts.
#info
@node(type callout, tone info)
...
node@
info#

#warn
@node(type callout, tone warn)
...
node@
warn#

#error
@node(type callout, tone error)
...
node@
error#

~ Figure with src + id captures.
#figure ||src, id||
@node(type figure, src ::src::, id ::id::)
...
node@
figure#

~ Math.
#math_block ||expr||
@node(type math, display block)
::expr::
node@
math_block#

#math_inline ||expr||
@node(type math, display inline) ::expr:: node@
math_inline#

~ Diagrams — one per engine.
#mermaid
@node(type diagram, engine mermaid)
...
node@
mermaid#

#graphviz
@node(type diagram, engine graphviz)
...
node@
graphviz#
```

Author files reference it and call the wrappers:

```
reference ./shared/types.wit

@info The lamp's lens is a second-order Fresnel. info@

@figure |src plates/fresnel.jpg| |id fig_fresnel|
The lens uses concentric prisms to collimate light.
figure@

@mermaid
graph LR
  A[Source] --> B(Parse) --> C(Render)
mermaid#
```

The project's renderer dispatches on the underlying `type` (`callout`,
`figure`, `diagram`); authors never see those names. When the
renderer is extended with a new variant, only `shared/types.wit`
needs a new wrapper def.

## See also

- [`02-defs-and-captures.md`](./02-defs-and-captures.md) — the block-form def + body splice mechanics the wrappers use.
- [`06-custom-renderers.md`](./06-custom-renderers.md) — building a
  renderer that handles these types.
- [`10-document-assembly.md`](./10-document-assembly.md) — `shared/types.wit` lives at the project root, pulled in by `reference`.
- [`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md) — `<% %>`
  can post-process custom nodes via `lh.query('node')`.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §27 — the bare `@node(type X)` shape.
