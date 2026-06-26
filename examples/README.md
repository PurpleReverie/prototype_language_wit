# Examples

A guided tour of Wit's surface, one feature per file. Each example is a
self-contained `.wit` document that demonstrates a specific concept.
Read top-to-bottom for a learning path; jump to a specific file to see
how something is written.

## Run an example

From the repo root:

```
pnpm build
node packages/cli/dist/bin.js tour examples/01-prose.wit
node packages/cli/dist/bin.js build examples/01-prose.wit -o /tmp/out.html
```

Or after installing `@witlang/cli` from npm:

```
wit tour examples/01-prose.wit
wit build examples/01-prose.wit -o /tmp/out.html
```

## The tour

| File | What it demonstrates |
|---|---|
| [`01-prose.wit`](./01-prose.wit) | Plain prose. Paragraphs, soft line breaks, blank-line separation. |
| [`02-emphasis.wit`](./02-emphasis.wit) | `_italic_`, `*bold*`, and combinations. |
| [`03-comments.wit`](./03-comments.wit) | Line comments (`~ ...`) and block comments (`~~ ... ~~/`). |
| [`04-using-nodes.wit`](./04-using-nodes.wit) | Invoking nodes: bare references, block form, inline use. |
| [`05-parameters.wit`](./05-parameters.wit) | The five param-invocation forms: pipes, parens (space + colon style), record-arg, form-fill body, colon scatter. |
| [`06-indentation.wit`](./06-indentation.wit) | How Wit treats whitespace — what's preserved, what's not. |
| [`07-defining-nodes.wit`](./07-defining-nodes.wit) | `#name … name#` definitions with captures and interpolation. |
| [`08-single-line-defs.wit`](./08-single-line-defs.wit) | `#name: value !!` single-line definition shape. |
| [`09-citations.wit`](./09-citations.wit) | Inline citation pattern using definitions. |
| [`10-records.wit`](./10-records.wit) | Record literals `{ key - value, … }`. |
| [`11-collections.wit`](./11-collections.wit) | Collection literals `[ item, item, … ]`. |
| [`12-accessing-data.wit`](./12-accessing-data.wit) | Dotted access `@x.field` into records. |
| [`13-conditionals.wit`](./13-conditionals.wit) | `(if @x is …) … (end)` blocks. |
| [`14-iteration.wit`](./14-iteration.wit) | `(each @items as item) … (end)` loops. |
| [`15-references/`](./15-references/) | The `reference` directive for multi-file projects. |
| [`16-additive-partials/`](./16-additive-partials/) | `+#name` additive contributions merged across files. |
| [`17-scripting.wit`](./17-scripting.wit) | `<% expr %>` script blocks and the `lh.*` runtime bridge. |
| [`thesis/`](./thesis/) | A multi-file long-form document. The most ambitious example. |

## Where to start

- **First time?** Read `01-prose.wit` and `02-emphasis.wit`. Wit looks
  a lot like Markdown until you need structure.
- **Want to see structure?** `04-using-nodes.wit` and `07-defining-nodes.wit`
  introduce the node-and-template machinery.
- **Want to see data?** `10-records.wit` through `14-iteration.wit` cover
  the data side.
- **Want a real document?** Open `thesis/` and read the master file.

## See also

- [Root README](../README.md) — installation, architecture, philosophy.
- [`tests/fixtures/`](../tests/fixtures/) — the executable spec; one fixture
  per language feature, organized by category.
- [`tests/integration/feature-tour.wit`](../tests/integration/feature-tour.wit)
  — one file exercising every AST kind for the readiness report card
  (`pnpm test:tour`).
