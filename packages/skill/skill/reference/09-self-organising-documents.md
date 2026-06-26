# Self-organising documents — data drives content

The single biggest unlock Wit offers over Markdown: **define your
document's structure as data once, render it many ways from the same
source**. Reorder a list, add a chapter, swap a finding — the table
of contents, the body, the cross-references, and the "see also"
sidebars all stay consistent because they share a single source of
truth.

This file is the canonical patterns for documents that re-render
correctly when you change them.

## Define the structure as data

The starting move for every self-organising document is to lift the
structure into a record collection. Don't write the chapter list
twice (once in the TOC, once in the prose) — write it once in data,
let everything else iterate.

```
#chapters: [
  { number - I,   title - The Lamp,     id - lamp,    file - chapters/01.wit }
  { number - II,  title - The Voice,    id - voice,   file - chapters/02.wit }
  { number - III, title - The Stranger, id - stranger, file - chapters/03.wit }
]
```

Every field that downstream rendering needs goes here. The `id` field
is the cross-reference handle; the `file` is for an assembled
multi-file document (see [`10-document-assembly.md`](./10-document-assembly.md)).

## Pattern 1 — TOC + body from one source

Render the table of contents and the chapter bodies from the same
collection. Reordering the records reorders both.

```
#chapter_toc_row ||number, title, id||
@li ::number:: — @a |href #::id::| ::title:: a@ li@
chapter_toc_row#

#chapter_body ||number, title||
@h2 ::number:: — ::title:: h2@
...
chapter_body#

~ TOC: walk the data once.

@ul
(each @chapters as ch)
@chapter_toc_row |number @ch.number| |title @ch.title| |id @ch.id| chapter_toc_row@
(end)
ul@

~ Body: walk the same data, render full sections.

(each @chapters as ch)
@chapter_body |number @ch.number| |title @ch.title|
Body content for chapter ::number::.
chapter_body@
(end)
```

Add a chapter to the record — both the TOC entry and the body slot
appear without you touching either render call.

## Pattern 2 — Auto-numbered figures with backrefs

A `#figures` collection holds every figure in the document. Each
figure has an `id` that prose references via a `figref` custom node;
the renderer assigns numbers in document order.

```
#figures: [
  { id - dunmore,  src - plates/dunmore-head.jpg, caption - Dunmore Head lighthouse }
  { id - fresnel,  src - plates/fresnel.jpg,       caption - Second-order Fresnel lens }
  { id - logbook,  src - plates/logbook.jpg,       caption - Keeper's logbook, March 1857 }
]

(each @figures as f)
@node(type figure, id @f.id, src @f.src)
@f.caption
node@
(end)

~ Anywhere in prose:

As @node(type figref, target fresnel) node@ shows, the lens uses
concentric prisms to collimate light.
```

The renderer walks the document keeping a counter; each `figref`
becomes "Fig. N" pointing at the matching `id`. Reorder the figures
list — every backref renumbers automatically.

For renderer dispatch on `figure` and `figref`, see
[`08-custom-nodes.md`](./08-custom-nodes.md).

## Pattern 3 — Glossary with auto-cross-linking

A `#glossary` collection of terms + definitions. Every mention in
prose becomes a link to the definition.

```
#glossary: [
  { id - fresnel,  term - Fresnel lens,    def - A compact lens of concentric prisms. }
  { id - keeper,   term - keeper,          def - The lighthouse maintainer on duty.   }
  { id - second_order, term - second-order, def - A classification by focal length.   }
]
```

In prose, mark mentions with `@node(type term, target X)`:

```
The @node(type term, target keeper) keeper node@ trimmed the wick of
the @node(type term, target second_order) second-order node@
@node(type term, target fresnel) Fresnel lens node@.
```

Renderer side: emit a tooltip or hover-link to the glossary entry.
A standalone glossary section iterates `@glossary` to print all
definitions. See [`13-glossary-and-cross-references.md`](./13-glossary-and-cross-references.md)
for the full pattern.

## Pattern 4 — "See also" sidebars from related-refs

Each section can list related sections by id; the sidebar renders
from that data.

```
#sections: [
  { id - attention, title - On Attention,
    related - [ generosity, perception ] }
  { id - generosity, title - On Generosity,
    related - [ attention ] }
  { id - perception, title - On Perception,
    related - [ attention ] }
]

(each @sections as s)
@section { id: @s.id, title: @s.title }

~ Render the section body here.

~ Sidebar from the related list:

@node(type sidebar, label See also)
(each @s.related as r)
@a |href #::r::| ::r:: a@
(end)
node@
(end)
```

Refactor what counts as "related" by editing one record's `related`
field — every page's sidebar updates.

## Pattern 5 — Bibliographic backrefs

Combine with [`04-citations.md`](./04-citations.md): each citation
def can record which sections cite it, and a per-source page can
backlink to those sections.

```
#weil_attention: @weil p. 117 !!
#weil_generosity: @weil p. 42 !!

~ Bibliography page lists every #weil_* and back-links to each use:

<%
const weilUses = lh.query('node')
  .filter(n => n.params.target?.startsWith('weil_'));
lh.inject('weil-backrefs', `…rendered backref list…`);
%>
```

This pattern relies on the `<% %>` script bridge — see
[`11-derived-content-recipes.md`](./11-derived-content-recipes.md)
for ready-made recipes.

## The principle

Data is the source of truth. Prose is one of its views. Cross-refs,
backrefs, TOCs, lists, sidebars, indices — all views of the same
underlying records. When the data changes, every view re-renders
correctly.

Resist the urge to inline a chapter number, a figure number, a "see
section X" in prose. Reach for the data instead — your future self
will reorder something, and you don't want to chase every reference.

## See also

- [`03-data-records-iteration.md`](./03-data-records-iteration.md) — records, collections, iteration mechanics.
- [`10-document-assembly.md`](./10-document-assembly.md) — multi-file
  assembly via `reference` + additive partials.
- [`11-derived-content-recipes.md`](./11-derived-content-recipes.md) — `<% %>` patterns that post-process self-organising structures.
- [`13-glossary-and-cross-references.md`](./13-glossary-and-cross-references.md) — the term + figref + section-ref shapes in depth.
