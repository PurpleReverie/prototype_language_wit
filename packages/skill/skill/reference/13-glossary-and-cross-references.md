# Glossary, terms, and cross-references

Long documents accumulate jargon, figures, equations, sections, and
chapters that need to be referenced from elsewhere. The patterns here
let you **define each reference target once and refer to it many
times**, with auto-numbering and backrefs handled by data + scripts.

This builds on the custom-node extension point from
[`08-custom-nodes.md`](./08-custom-nodes.md) and the self-organising
patterns from [`09-self-organising-documents.md`](./09-self-organising-documents.md).

## Glossary terms — auto-linked mentions

Define every term once in a glossary collection; mark mentions in
prose with `@node(type term, target X)`; the renderer turns each
mention into a tooltip, link, or footnote pointing at the definition.

### Author side

```
#glossary: [
  { id - fresnel,
    term - Fresnel lens,
    def - A compact lens of concentric annular prisms, invented by
          Augustin-Jean Fresnel in 1819. Used in lighthouses for its
          long focal length at low mass. }

  { id - keeper,
    term - keeper,
    def - The lighthouse maintainer on duty; responsible for the
          lamp, the bell, the log, and the structure itself. }

  { id - second_order,
    term - second-order,
    def - A classification of lighthouse lenses by focal length;
          second-order is intermediate, typical of harbour lights. }
]
```

In prose, mark each mention. The body of the `@node` is the surface
text (which may differ from the defined term — "Fresnel" vs "Fresnel
lens"):

```
The @node(type term, target keeper) keeper node@ trimmed the wick of
the @node(type term, target second_order) second-order node@
@node(type term, target fresnel) Fresnel lens node@ before the second
bell.
```

### Renderer side

The renderer walks the AST, finds every `term`-typed node, looks up
the `target` id in `#glossary`, and emits a tooltip / hover-link /
footnote depending on the target format:

```ts
function renderTerm(node, glossary) {
  const entry = glossary.find(g => g.id === node.params.target);
  if (!entry) return passthrough(node);
  return `<abbr class="term" title="${escape(entry.def)}">${
    renderInline(node.content)
  }</abbr>`;
}
```

For Markdown (no hover): emit the surface text with a superscript
ref to a glossary section at the end. For print: emit the surface
text and a marginal note. The data is the same; only dispatch
differs.

### Standalone glossary section

A glossary appendix iterates the same collection:

```
@h2 Glossary h2@

@dl
(each @glossary as g)
@dt ::g.term:: dt@
@dd ::g.def:: dd@
(end)
dl@
```

Or in a renderer that doesn't support `@dl`/`@dt`/`@dd`, use a
custom node:

```
(each @glossary as g)
@node(type glossary_entry, id @g.id)
**@g.term** — @g.def
node@
(end)
```

## Figure auto-numbering + backrefs

Combine a `#figures` collection with `@node(type figure)` (definition)
and `@node(type figref)` (reference). The renderer assigns numbers
in document order and rewrites figrefs to numeric backrefs.

```
#figures: [
  { id - dunmore, src - plates/dunmore.jpg,
    caption - Dunmore Head lighthouse, view from the cove }
  { id - fresnel, src - plates/fresnel.jpg,
    caption - Second-order Fresnel lens, schematic }
  { id - logbook, src - plates/logbook.jpg,
    caption - Keeper's logbook, March 1857 }
]

(each @figures as f)
@node(type figure, id @f.id, src @f.src)
::f.caption::
node@
(end)

~ Prose elsewhere:

As @node(type figref, target fresnel) node@ shows, the lens uses
concentric prisms to collimate light from a small point source.

The keeper's notes (@node(type figref, target logbook) node@)
record an unusual fog pattern on the night of 14 March.
```

### Renderer-side numbering

```ts
function assignFigureNumbers(expanded) {
  const figs = walk(expanded).filter(n =>
    n.kind === 'node' && n.params.type === 'figure');
  const idToNum = {};
  figs.forEach((f, i) => {
    idToNum[f.params.id] = i + 1;
  });
  return idToNum;
}

function renderFigref(node, idToNum) {
  const num = idToNum[node.params.target];
  return num ? `Fig.&nbsp;${num}` : `Fig.&nbsp;?`;
}
```

Reorder the `#figures:` collection — every figref renumbers
automatically. Add a new figure mid-document — every later figref
shifts to match.

## Equation cross-references

Same shape as figures. Equations are typeset via
`@node(type math)` (see [`08-custom-nodes.md`](./08-custom-nodes.md#math--latex-bodies-via-mathjax--katex));
references via `@node(type eqref, target X)`.

```
#equations: [
  { id - eq_attention, label - 1, body - A = \\int_0^T a(t) \, dt }
  { id - eq_labour,    label - 2, body - L = \\alpha \\cdot A     }
]

(each @equations as eq)
@node(type math, id @eq.id, display block)
@eq.body
node@
(end)

By equation @node(type eqref, target eq_labour) node@, labour is
proportional to attention.
```

## Section / chapter cross-references

The same pattern works for sections. Give each section an `id` in
its record; reference by id from elsewhere.

```
#sections: [
  { id - intro,    title - Introduction, file - chapters/01.wit }
  { id - argument, title - The argument, file - chapters/02.wit }
  { id - findings, title - Findings,     file - chapters/03.wit }
]

(each @sections as s)
@section { id: @s.id, title: @s.title }
~ section body
section@
(end)

~ Elsewhere:

I return to this question in
@node(type sectionref, target findings) node@.
```

The renderer rewrites `sectionref` to "§3 (Findings)" or
"<a href='#findings'>Findings</a>" depending on target.

## Term + figure + section: all the same shape

Notice the symmetry. Every reference target is:

1. **Defined once** in a record collection (`#glossary`, `#figures`,
   `#equations`, `#sections`).
2. **Has a unique `id`** as the cross-reference handle.
3. **Has a human-facing label** (term / caption / title / label).
4. **Referenced via `@node(type ref_kind, target id)`** in prose.
5. **Numbered or labeled at render time** by walking the document.

Pick one set of conventions for your project and stick to them.

## Reverse references — bibliography backrefs

For sources cited multiple times across a document, the bibliography
entry can list every section that cites it. See
[`11-derived-content-recipes.md`](./11-derived-content-recipes.md#recipe-9--bibliography-backrefs)
for the `<% %>` script.

The pattern: walk the citations, group by source, inject backref
links into the bibliography entries.

## What the renderer needs

To support these patterns, the consumer renderer must:

- **Walk the expanded AST in document order** (already required for
  rendering anything).
- **Maintain a per-pass counter** for numbered references.
- **Look up `target` ids** against the relevant data collections.
- **Emit the right surface form** for the target format (links for
  HTML, footnotes for print, plain text for Slack).

None of this requires special parser support — `@node(type X)` is
the universal opening, and the rest is renderer code.

## Authoring tip — keep the reference shape consistent

The biggest mistake is inventing one shape per reference type
("@figref" for figures, "@s_ref" for sections, "@cite_to" for
citations). It gets unmaintainable fast.

**Use `@node(type X, target Y)` for every cross-reference.** Vary
`type` for the kind (figref, sectionref, eqref, term, cite); keep
`target` as the universal handle. Renderers stay simple, authoring
stays predictable, scripts stay portable across reference kinds.

## See also

- [`08-custom-nodes.md`](./08-custom-nodes.md) — the `@node(type X)` extension point and the `figref` / `term` examples.
- [`09-self-organising-documents.md`](./09-self-organising-documents.md) — auto-numbered figures, see-also sidebars.
- [`11-derived-content-recipes.md`](./11-derived-content-recipes.md) — recipes 5, 8, 9 implement the cross-ref scripts.
- [`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md) — citation cross-refs and "ibid" backref handling.
