# Thesis stress test — `Attention as a Moral Practice`

A small, multi-file Wit project that exercises feature composition end
to end: cross-file references, additive partials, conditional
rendering, iteration over a data collection, inline scripting via the
`lh` bridge, and rendering through both the HTML and Markdown back ends.

## Layout

```
examples/thesis/
  master.wit
  shared/
    schema.wit      # cite / theorem / chapter / section / h1..h3 / entry / watermark
    sources.wit     # primary refs + argument-map (named ideas pinned to a source)
  chapters/
    00-frontmatter.wit                  # exposes #frontmatter
    01-introduction.wit                 # #chapter_one
    02-attention-and-labour.wit         # #chapter_two
    03-the-asymmetry-of-looking.wit     # #chapter_three
    04-conclusion.wit                   # #chapter_four
  thesis.html         # committed HTML render
  thesis.md           # committed Markdown render
```

Each chapter file `reference`s the shared schema and sources, and
exposes its body as a `#chapter_N` node so the master can compose them
in order with `@chapter_N chapter_N@`.

## Build

```sh
pnpm build
node packages/cli/dist/bin.js build examples/thesis/master.wit \
     -o examples/thesis/thesis.html
node packages/cli/dist/bin.js build examples/thesis/master.wit \
     -o examples/thesis/thesis.md
```

The CLI infers HTML vs Markdown from the `-o` extension. To override,
pass `--format html|md` explicitly.

## Features exercised

- Cross-file `reference ./...` from every chapter file plus master.
- Additive `+#bibliography:` partials in each chapter, rendered at the
  end of the conclusion via `@bibliography bibliography@`.
- Template with named captures: `@chapter |number 1| |title Introduction|`
  (the `#chapter` template lays down an ATX heading literal that both
  renderers pass through verbatim).
- Inline citations driven by named captures: `#cite: ::author:: (::year::) !!`.
- An argument map of named ideas (`#weil_attention`, `#berger_looking`, …),
  each a single-line def whose body cites the source + page.
- A draft-watermark conditional in master.wit:
  `(if @thesis.status is draft) @watermark() (end)`.
- A `(each @source_list as src) ... (end)` block in the conclusion that
  walks a `#source_list:` collection literal.
- An inline script `<% lh.prose().wordCount() %>` in chapters 2 and 4
  that splices the running word count into the prose.

## Known gaps

A few patterns suggested by the M8 brief don't survive the current
parser/runtime path well; the thesis sidesteps them rather than
working around them inline:

- **Inline emphasis in additive-partial bodies** fragments the entry
  into one paragraph per text/italic run. Bibliography entries
  therefore use plain text titles in this demo (e.g. `Gravity and
  Grace.` rather than `_Gravity and Grace_.`).
- **`(each @bibliography as entry)` doesn't iterate** because
  `#bibliography` is an additive `NodeDef`, not a `DataDef`
  `Collection`. The iteration requirement is satisfied by the
  `#source_list` collection literal in chapter 4 instead.
- **Multi-line record/collection defs** (`#thesis: { … } !!` spanning
  multiple lines) don't classify as `DataDef` under M7.datadef-classify,
  so `#thesis:` is written on a single line.
- **Block-shape templates that wrap content via `...`** don't keep the
  use's body content together when the def is single-line. Chapters
  define `#chapter_N` block-shape themselves rather than relying on a
  generic `#section` wrapper around captured body content.

These are language-runtime limitations, not flaws in this demo;
documenting them keeps the next implementer from rediscovering them.
