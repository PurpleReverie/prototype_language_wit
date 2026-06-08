# Wit

A prose-first markup language for people who write — and the systems that consume what they write.

This repo is the working space for designing the Wit language. The spec is the source of truth; the examples are how we pressure-test the syntax.

## What's here

- **`wit-spec.pdf`** — the current iteration of the language spec.
- **`examples/`** — one small `.wit` file per feature, used to iterate on syntax decisions in isolation.

## The examples

Each file is single-purpose. Edit one to test how a feature's syntax feels without disturbing the others.

| # | File | Feature |
|---|---|---|
| 01 | `01-prose.wit` | Prose-as-default, paragraphs |
| 02 | `02-emphasis.wit` | `_italic_`, `*bold*` |
| 03 | `03-comments.wit` | `\- … -\` |
| 04 | `04-using-nodes.wit` | `@name … name@` block and inline |
| 05 | `05-parameters.wit` | `\|value\|`, `\|key - value\|`, `\|flag\|`, last-one-wins |
| 06 | `06-indentation.wit` | Indentation is cosmetic |
| 07 | `07-defining-nodes.wit` | `#name`, `\|\|captures\|\|`, `::interp::`, `...` body slot |
| 08 | `08-single-line-defs.wit` | `#name:` and `! … !` complex values |
| 09 | `09-citations.wit` | Schema → sources → argument map → prose |
| 10 | `10-records.wit` | `{ }` records, inline / multi-line / nested |
| 11 | `11-collections.wit` | `[ ]` of values, of records |
| 12 | `12-accessing-data.wit` | Dot notation, indices, fuzzy key matching |
| 13 | `13-conditionals.wit` | `(if)`/`(else)`/`(end)` |
| 14 | `14-iteration.wit` | `(each @coll as item)` |
| 15 | `15-references/` | Multi-file: `reference ./path` composition |
| 16 | `16-additive-partials/` | Multi-file: `+#name` self-registering chapters |
| 17 | `17-scripting.wit` | `<script>` + the `lh` bridge |

The lighthouse / Aldous Vane thread from the spec runs through the examples on purpose — they read as one corpus rather than disconnected snippets.

## Status

Design phase. No parser, no renderer yet. The point of the examples is to find the rough edges in the syntax before any of that gets built.
