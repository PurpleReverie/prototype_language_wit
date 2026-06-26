# Citation styles, footnotes, and reference chains

[`04-citations.md`](./04-citations.md) establishes the
argument-map pattern: schema → sources → ideas → prose. This file
goes deeper — switching between citation styles, footnotes vs inline,
"ibid" handling, multi-source citations, see-also chains, and the
patterns long-form academic writing actually needs.

Read 04 first; the foundations there are assumed below.

## Switching citation styles

The argument-map pattern decouples the citation **content** (what
gets cited where) from the citation **rendering** (how it looks).
Swap one for the other by changing only the `#cite` schema.

### Chicago author-date

```
#cite ||author, title, year, page||
::author:: ::year::, ::page::
cite#
```

Renders as: `Weil 1952, 117`.

### MLA in-text

```
#cite ||author, title, year, page||
::author:: ::page::
cite#
```

Renders as: `Weil 117`.

### APA author-date with parens

```
#cite ||author, title, year, page||
(::author::, ::year::, p. ::page::)
cite#
```

Renders as: `(Weil, 1952, p. 117)`.

### Full footnote-style

```
#cite ||author, title, year, publisher, page||
::author::, _::title::_ (::publisher::, ::year::), ::page::.
cite#
```

Renders as: `Weil, *Gravity and Grace* (Routledge, 1952), 117.`

### Switching at the project level

Each style lives in its own file under `citations/`:

```
project/
  citations/
    chicago.wit       # #cite for Chicago
    mla.wit           # #cite for MLA
    apa.wit           # #cite for APA
    footnote.wit      # #cite for footnotes
  sources/
    weil.wit          # #weil: @cite { … } !!
    berger.wit        # #berger: @cite { … } !!
  thesis.wit          # references one of the citations/ + all sources
```

Change one `reference` line in the root to switch the entire
document's citation style. The sources files don't change; only the
schema does.

For conditional / build-time switching see
[`12-faceted-content.md`](./12-faceted-content.md#pattern-5--multiple-bibliographies).

## Inline citations vs footnotes

Two genres. Both build on the argument-map pattern; the difference
is where the citation surfaces in the output.

### Inline citations (the default)

The bare-ref pattern from 04:

```
Attention, as @weil_attention argued, is a moral act.
```

Renders inline: `Attention, as Weil 1952, 117, argued, is a moral
act.`

Best for: papers where citations are short and frequent.

### Footnote citations

The argument map entry becomes a footnote attached to the surrounding
prose. Mark the attach point with `@node(type footnote_ref, target X)`:

```
#weil_attention:
@cite { author: Weil, title: Gravity and Grace, year: 1952, page: 117 }
!!

Attention is a moral act
@node(type footnote_ref, target weil_attention) node@.
```

The renderer walks the document, collects every `footnote_ref` in
order, assigns numbers, and emits an endnotes section. See
[`08-custom-nodes.md`](./08-custom-nodes.md#footnotes--endnotes)
for the renderer dispatch.

Best for: books and long-form essays where the prose flow can't
absorb inline citations without losing rhythm.

### Picking the genre

Inline is the default for academic papers. Footnotes are the default
for books, long essays, anything where the citation is informational
rather than argumentative. Don't mix the two in one document — pick
one and stick to it.

## "Ibid" handling

When consecutive citations reference the same source, traditional
typography substitutes "ibid." (or "ibid., p. N" if the page
differs). Wit handles this as a render-time transformation via the
`<% %>` script bridge.

```
<%
const cites = lh.query('node').filter(n => n.params.type === 'cite');
let prev = null;
cites.forEach((c) => {
  if (prev && prev.params.source === c.params.source) {
    const text = prev.params.page === c.params.page
      ? 'ibid.'
      : `ibid., p. ${c.params.page}`;
    lh.inject(c.params.injectId, text);
  }
  prev = c;
});
%>
```

For this to work, citations need to surface their `source` (which
argument-map entry they come from) and `page` as params on the
expanded node. The argument-map entry can pass them through:

```
#weil_attention:
@node(type cite, source weil, page 117) ::cite-rendered-here:: node@
!!
```

This is more complex than a bare `#weil_attention: @weil p. 117 !!`
— reach for it only if "ibid" handling actually matters for the
document.

## Multi-source citations

A claim that's supported by multiple sources at once. The standard
shape is a list:

```
#cite_list ||refs||
::refs::
cite_list#

(each @refs as r)
@r
(end)
```

Author side:

```
The asymmetry of looking
@cite_list |refs weil_attention, berger_looking, foucault_panopticon|.
```

Renderer side: each item in `refs` resolves to its argument-map
entry. The list separator is renderer-controlled (semicolons,
commas, "and" for the last).

For the bare-ref case:

```
This claim is widely supported (@weil_attention; @berger_looking;
@foucault_panopticon).
```

Less elegant but works without a `#cite_list` def.

## See-also chains

A citation that triggers a "see also" pointer to related citations.

```
#weil_attention:
@cite { author: Weil, year: 1952, page: 117 }.
@node(type see_also, refs berger_looking, simone_de_beauvoir_looking)
node@
!!
```

The renderer treats `see_also` as a follow-on note that renders
after the citation, listing related references.

In practice this is most useful in a footnotes/endnotes context
where the see-also has room to expand without breaking prose flow.

## Bibliography backrefs

The bibliography page lists every source and which sections cited
it. See
[`11-derived-content-recipes.md`](./11-derived-content-recipes.md#recipe-9--bibliography-backrefs)
for the script. The high-level shape:

```
@bibliography
(each @sources as s)
@bib_entry { id: @s.id }
@s.author, _@s.title_ (@s.year).
@node(type backrefs, source @s.id) node@
bib_entry@
(end)
bibliography@
```

The `backrefs` script populates each `backrefs` node with links to
the sections that cited the source. Reorder sections; backrefs stay
correct.

## Page-locator variations

Argument-map entries can encode richer page locators than a single
page number — ranges, chapters, line numbers, sections:

```
#weil_attention:    @weil p. 117 !!
#weil_chapter:      @weil ch. 3 !!
#weil_range:        @weil pp. 117–125 !!
#berger_section:    @berger §1.4 !!
#aurelius_book:     @aurelius Bk. IV, 23 !!
```

Each is its own argument-map entry — the page locator is part of the
**idea**, not a runtime parameter.

## Citing the same source many times

When one source supports many ideas, define one argument-map entry
per idea. Don't reuse the bare `@weil` and pass pages each time —
that erases the idea-naming benefit.

**Anti-pattern.**

```
Attention is rare @weil p. 117. Generosity follows @weil p. 42.
```

**Preferred.**

```
#weil_attention:  @weil p. 117 !!
#weil_generosity: @weil p. 42  !!

Attention is rare @weil_attention. Generosity follows @weil_generosity.
```

The prose names ideas. The argument map binds ideas to pages. Future
you swaps a page number once.

## When the schema needs a runtime param

Occasionally a citation genuinely needs a parameter that varies per
use site (e.g., a quoted line within a cited section). Use captures:

```
#cite_quoted ||author, year, page, quote||
::author:: (::year::, p. ::page::): "::quote::"
cite_quoted#

@cite_quoted
  author: Weil
  year: 1952
  page: 117
  quote: Attention, taken to its highest degree, is the same thing as prayer.
cite_quoted@
```

Reserve this for the rare case the quote really belongs in the
citation rather than the prose. The bare-ref pattern is cleaner for
most uses.

## See also

- [`04-citations.md`](./04-citations.md) — the foundational argument-map pattern these patterns extend.
- [`08-custom-nodes.md`](./08-custom-nodes.md#footnotes--endnotes) — footnote rendering.
- [`10-document-assembly.md`](./10-document-assembly.md) — multi-file thesis layout, where citation-style switching usually lives.
- [`11-derived-content-recipes.md`](./11-derived-content-recipes.md) — recipe 6 ("ibid") and recipe 9 (backrefs).
- [`12-faceted-content.md`](./12-faceted-content.md) — switching style as a faceting pattern.
