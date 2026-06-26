# Document assembly — composing large docs from many files

A thesis, novel, or technical manual lives across many files: one
file per chapter, shared bibliographies, schema files referenced from
every section. Wit's `reference` directive plus additive partials
(`+#name`) is the mechanism.

## The `reference` directive

A line at the **top of a file** pulls in another file's definitions.
Paths are relative to the current file; references resolve
transitively.

```
reference ./shared/schema.wit
reference ../sources.wit
```

Once a file references another, every `#name` defined there is in
scope for `@name` uses in the current file.

**Constraints.**
- `reference` lines must come before any `#def` or prose.
- Paths use forward slashes regardless of platform.
- Circular references raise `E_CIRCULAR_REFERENCE` from the resolver.

## Thesis-style layout

One file per chapter, a shared schema file, a root file that
references the rest.

```
thesis/
  thesis.wit                 # root: references all chapters in order
  shared/
    schema.wit               # citation schema, common nodes
    sources.wit              # #weil:, #berger:, etc. — every source
  chapters/
    01-introduction.wit
    02-labour.wit
    03-asymmetry.wit
    04-conclusion.wit
```

**`shared/schema.wit`** — defines the citation contract:

```
~ The argument-map citation pattern (see 04-citations.md).

#cite ||author, title, year, page||
::author:: (::year::, p. ::page::). _::title::_.
cite#
```

**`shared/sources.wit`** — every primary source as a named instance:

```
reference ./schema.wit

#weil:    @cite { author: Weil,    title: Gravity and Grace, year: 1952 } !!
#berger:  @cite { author: Berger,  title: Ways of Seeing,    year: 1972 } !!
#arendt:  @cite { author: Arendt,  title: The Human Condition, year: 1958 } !!
```

**`chapters/01-introduction.wit`** — references shared, declares its
own argument map, writes prose:

```
reference ../shared/sources.wit

#weil_attention:  @weil p. 117 !!
#berger_looking:  @berger p. 9   !!

#chapter_one
@chapter |number 1| |title Introduction|

Attention, as @weil_attention argued, is the rarest form of
generosity. Berger complicates this @berger_looking by insisting
that we never look at one thing alone.
chapter_one#
```

**`thesis.wit`** — the root file, references and renders. Each
chapter is invoked with an **explicit close** (`@chapter_one
chapter_one@`); the bare `@chapter_one` form only works for
value-block defs and only inside an inline prose context, neither of
which fits chapter exports cleanly across files:

```
reference ./chapters/01-introduction.wit
reference ./chapters/02-labour.wit
reference ./chapters/03-asymmetry.wit
reference ./chapters/04-conclusion.wit

@frontmatter
@titlepage |title On Attention| |author Mara Finch| titlepage@
@toc toc@
frontmatter@

@chapter_one chapter_one@
@chapter_two chapter_two@
@chapter_three chapter_three@
@chapter_four chapter_four@
```

The ordering of `reference` lines + the order of invocations at the
root determines the order chapters appear.

## Additive partials — `+#name`

A leading `+` on a single-line def **contributes to a merged partial
that spans every file in the document**. Each contributing file adds
entries; the final `#name` is the union.

Useful for shared lists that grow as you write — bibliographies,
figure indices, glossary terms, errata.

```
~ chapters/01-introduction.wit contributes:
+#bibliography: @entry Berger, Ways of Seeing (1972). entry@ !!
+#bibliography: @entry Weil, Gravity and Grace (1952). entry@ !!

~ chapters/02-labour.wit also contributes:
+#bibliography: @entry Arendt, The Human Condition (1958). entry@ !!

~ thesis.wit (or any file referencing all chapters) renders the merged set:
@bibliography
(each @bibliography as entry)
@entry
(end)
@bibliography@
```

Order: entries appear in document-traversal order — the order in
which their files are referenced from the root.

## Practical patterns

### One bibliography for the whole document

The most common use of additive partials. Each chapter file
`+#bibliography:` its own references; the root file renders the
merged list at the end. Authors never have to compile the
bibliography manually.

### Cross-chapter figures

Combine [`09-self-organising-documents.md`](./09-self-organising-documents.md)
with additive partials:

```
+#figures: { id - dunmore, src - plates/dunmore.jpg, caption - Dunmore Head } !!
+#figures: { id - fresnel, src - plates/fresnel.jpg, caption - Fresnel lens } !!
```

Figures contributed across files; the root iterates `@figures` to
produce a list-of-figures section.

### Shared term glossary

Each chapter `+#glossary:` terms it introduces; the root renders the
glossary in alphabetical order via a `<% %>` sort.

## The file contract

A typical file in a thesis-style project owns three things:

1. **A primary def or two** — the chapter wrapper, exported by name
   (`#chapter_one`).
2. **Argument-map entries** — `#weil_attention:`, `#berger_looking:`
   tied to that chapter's citations.
3. **Contributions** to additive partials — `+#bibliography:`,
   `+#figures:`, `+#glossary:`.

Everything else (schemas, sources, core node defs) belongs in the
shared files. Keeping the discipline tight makes the document
genuinely modular — you can move chapters between projects.

## What can't cross files

Wit's resolver is single-pass and lexically scoped. A few things to
know:

- **Local-only defs** — defs declared inside a single file without
  being referenced from elsewhere are private to that file's
  resolution.
- **Captures don't cross files** — captures are bound by call site;
  the def can live anywhere.
- **Conditionals + iteration are evaluated at expand time** —
  referenced data must be fully resolved by then. Don't put
  cross-file timing assumptions in `<% %>`.

## When NOT to assemble

If the document is short enough to fit comfortably in one file,
**don't split it**. Multi-file assembly adds navigation cost. The
threshold worth noting: when the same file you'd be editing also has
many sources/citations/figures it doesn't strictly use yet, you're
ready to split.

## See also

- [`02-defs-and-captures.md`](./02-defs-and-captures.md) — additive
  partials shape and constraints.
- [`04-citations.md`](./04-citations.md) — the citation pattern this
  layout is built around.
- [`09-self-organising-documents.md`](./09-self-organising-documents.md) — how data drives content; pairs with additive partials.
- [`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md) — switching citation styles in a multi-file thesis.
