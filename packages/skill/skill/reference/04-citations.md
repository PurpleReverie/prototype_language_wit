# Citations — the named-source argument-map pattern

Citations in Wit should read as **ideas, not page numbers**. The
pattern is four steps: define the schema once, name the sources, build
an argument map, write prose where citations are two words long.

This is the most distinctive Wit pattern. Reach for it whenever a
document has references.

## Step 1 — define the citation schema

A block-form def with captures (`||a, b, …||`) names the rendering
contract.

```
#cite ||author, title, year, publisher, page||
::author:: (::year::, p. ::page::). _::title::_. ::publisher::.
cite#
```

## Step 2 — name your sources as instances of the schema

One value-block def per source, calling the schema with the source's
constants. The source's name (`@weil`, `@berger`) becomes the citation
handle.

```
#weil:   @cite { author: Weil,   title: Gravity and Grace, year: 1952, publisher: Routledge } !!
#berger: @cite { author: Berger, title: Ways of Seeing,    year: 1972, publisher: Penguin   } !!
```

## Step 3 — argument map: name the IDEA, not the page

For each idea you'll cite, a single-line def composed of the source
plus the page locator. The name of the def is the **idea**.

```
#weil_attention:  @weil p. 117 !!
#weil_generosity: @weil p. 42  !!
#berger_looking:  @berger p. 9 !!
```

## Step 4 — write prose. Citations are two words long.

```
Attention, as @weil_attention argued, is the rarest form of
generosity. Berger complicates this @berger_looking by insisting that
we never look at one thing alone.
```

The prose names ideas. The argument map binds those ideas to sources
and pages. The schema renders the citation. Each layer can change
without touching the others — swap a page number once, every prose
mention updates.

When a reference needs no parameters at all, the bare name is enough:

```
The lamp burned, as @weil knew it would.
```

## Bibliographies — pick the form that reads best

For a bibliography block (one entry per row, not woven into prose),
the same template handles any invocation form. Block-form defs with
captures (`||…||`) are what binds named arguments at the call site.

```
#ref ||author, title, year, page||
_::title::_, ::author:: (::year::), p. ::page::
ref#
```

**Form-fill body** — preferred when fields are many or values are long:

```
@ref
  author: Trinity House
  title: Lighthouse Engineering — a Practical Guide
  year: 1981
  page: 203
ref@
```

**Record-arg** — names + brace literal, single line:

```
@ref { author: Berger, title: Ways of Seeing, year: 1972, page: 9 }
```

**Iteration over a bibliography record** — the structured option for
generating a references section programmatically:

```
#refs: [
  { author - Weil,    title - Gravity and Grace,        year - 1952, page - 117 }
  { author - Berger,  title - Ways of Seeing,           year - 1972, page - 9   }
  { author - Trinity, title - Lighthouse Engineering,   year - 1981, page - 203 }
]

(each @refs as r)
@ref |author @r.author| |title @r.title| |year @r.year| |page @r.page| ref@
(end)
```

## What this pattern buys you

- **Prose stays prose.** Citations are two words, not eight. The
  argument doesn't get shoved aside by parenthetical clutter.
- **One change, everywhere.** Update a page number in the argument
  map; every prose mention re-renders.
- **Ideas are named.** `@weil_attention` is documentation in itself.
  A reader skimming citations sees the argument arc.
- **No bibliography drift.** Sources + pages live in one place.

## See also

- [`02-defs-and-captures.md`](./02-defs-and-captures.md) — value-block defs, captures, body splice.
- [`03-data-records-iteration.md`](./03-data-records-iteration.md) — records and iteration drive the bibliography.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §5 (value-block defs), §6.5 (multi-capture defs).
