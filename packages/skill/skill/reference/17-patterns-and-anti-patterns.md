# Patterns and anti-patterns — a do/avoid checklist

A condensed reference of what to reach for vs what to avoid, grouped
by topic. Use it as a review checklist before submitting work. The
reasoning for each line is in the linked deep-dive file.

## Defs

| ✓ Do | ✗ Avoid |
|---|---|
| Use `#name: … !!` for named content blocks | Inline the same content in prose multiple times |
| Use block form `#name … name#` with `...` for wrappers | Forget `...` when the def takes a body (the body silently drops) |
| Use single-line `#name: value` for short string values | Single-line `#name: \|\|caps\|\| … !!` with captures (rendering is broken; use block form) |
| Wrap `@node(type X)` in named defs (`#info`, `#figure`) | Repeat the `type` param across calls |
| Use `+#partial:` for cross-file contributions | Hand-merge bibliographies / figure lists |

[`02-defs-and-captures.md`](./02-defs-and-captures.md) · [`08-custom-nodes.md`](./08-custom-nodes.md)

## Invocations

| ✓ Do | ✗ Avoid |
|---|---|
| Record-arg with `:` for structured calls (`{ k: v }`) | Pipes for everything (the `\|` is visually noisy) |
| Colon scatter for terse inline calls (`@x k:v x@`) | Mixing invocation forms in one call |
| Parens (`@x(k v)` / `@x(k: v)`) for self-closing inline calls | Pipes scatter through a body (ugly, avoid) |
| Place pipes-form calls **last** when invoking the same node multiple ways | Adjacent `@x(...)` calls without a blank line (LSP gets confused) |
| Quote multi-word values inside parens-colon: `(k: "a b")` | Unquoted multi-word colon values across commas |

[`01-invocation-forms.md`](./01-invocation-forms.md) · [`07-gotchas.md`](./07-gotchas.md)

## Data

| ✓ Do | ✗ Avoid |
|---|---|
| Use hyphen `-` as the field delimiter in data-def records | Use colon `:` (LSP rejects, CLI accepts inconsistently) |
| Lift document structure into a `#name:` collection | Duplicate lists in prose and data |
| Render lists via `(each @list as item)` iteration | Hand-write items that need to stay in sync |
| Schema-array tables: `@table \|schema …\|` with record rows | Inline CSV `\| cell \| cell \|` (unmaintainable, decouples data) |
| Use `@thing.field.subfield` for nested data access | Compute values in prose by hand |
| Keep `@` out of record values (use roles, ids, etc.) | Email addresses or other `@` strings inside records (breaks parsing) |

[`03-data-records-iteration.md`](./03-data-records-iteration.md)

## Citations

| ✓ Do | ✗ Avoid |
|---|---|
| Argument-map pattern: idea → source + page | Inline citation strings repeated in prose |
| Define each source once as a value-block def (`#weil: … !!`) | Repeat `Weil, Gravity and Grace, 1952, p. 117` ten times |
| Name ideas, not pages: `@weil_attention`, `@berger_looking` | Generic numeric refs like `@cite_3` |
| Swap citation style by changing only the `#cite` schema def | Format every citation differently |

[`04-citations.md`](./04-citations.md) · [`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md)

## Cross-references

| ✓ Do | ✗ Avoid |
|---|---|
| `@node(type ref_kind, target id)` for every cross-ref | Invent a new shape per ref type (`@figref`, `@s_ref`, `@cite_to`) |
| Give every reference target a stable `id` | Refer to "Section 3" in prose (renumbers break) |
| Maintain `#figures:`, `#sections:`, `#glossary:` collections | Embed counts and labels by hand |
| Walk the document once to assign numbers in `<% %>` | Pre-number figures or sections by hand |

[`09-self-organising-documents.md`](./09-self-organising-documents.md) · [`13-glossary-and-cross-references.md`](./13-glossary-and-cross-references.md)

## Custom nodes

| ✓ Do | ✗ Avoid |
|---|---|
| Wrap `@node(type X)` in a named def | Repeat the `type` param everywhere |
| Group project wrapper defs in `shared/types.wit` | Define wrappers ad-hoc per file |
| Provide graceful degradation (renderer passthrough) for unknown types | Hard-fail on unknown types |
| Document each project's supported custom types | Leave authors to discover by trial |

[`08-custom-nodes.md`](./08-custom-nodes.md)

## Multi-file

| ✓ Do | ✗ Avoid |
|---|---|
| `reference` lines at the **top** of the file, before any def | Bury references mid-file |
| Per-file argument map for citations local to that chapter | Define every citation in a single mega-file |
| `+#bibliography:` additive partials for cross-file lists | Hand-merge bibliographies |
| Each chapter file exports **one** main def (`#chapter_one`) | Sprinkle exports across the file |
| Shared schemas + sources + types in `shared/` | Duplicate the citation schema in every chapter |

[`10-document-assembly.md`](./10-document-assembly.md)

## Scripts

| ✓ Do | ✗ Avoid |
|---|---|
| Reach for declarative `(if)` / `(each)` first | `<% %>` for what conditionals can do |
| `<% %>` for genuinely imperative cases (counts, sorts, derived stats) | Re-implement rendering inside a script |
| Keep document-level scripts at the end of the file | Sprinkle `<% %>` blocks throughout the body |
| Use `lh.data` to read static data, `lh.set` to update it | Reach for closures over outer JS state |

[`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md) · [`11-derived-content-recipes.md`](./11-derived-content-recipes.md)

## Content principles

| ✓ Do | ✗ Avoid |
|---|---|
| Put content in node bodies | Pass content via a param value |
| Treat parameters as metadata only | Stuff sentences or paragraphs into params |
| Lift structure into data; let prose be one view | Duplicate facts in prose and data |
| Name ideas (`@weil_attention`, `@introduction_quote`) | Generic IDs (`@cite_1`, `@para_3`) |
| Comment out experiments with `~` | Delete and rewrite from scratch |

## The five-shape default

When unsure which form to reach for, default to one of the five
preferred shapes from the cheat sheet:

1. **Value-block def** for named content blocks: `#name: … !!`.
2. **Bare reference** in prose: `@name`.
3. **Record-arg** with colon delimiter: `{ k: v }`.
4. **Colon scatter** for short inline calls: `@x k:v x@`.
5. **Block-form def** for manuscript wrappers: `#name … name#`.

Anything else is a niche choice that should be justified by context.

## Five things to check before submitting

1. **No content lives in a param value.** Body content goes in the
   body; params are metadata.
2. **No duplicated lists.** If a list appears more than once, it
   should be defined as data and iterated.
3. **No raw `@node(type X)` calls outside `shared/types.wit`.** Wrap
   them in named defs.
4. **Citations follow the argument-map pattern.** Ideas have names;
   pages live in the argument map, not in prose.
5. **`wit check` is clean.** And the IDE shows no red squiggles —
   the LSP catches things the CLI sometimes misses.

## See also

- [`15-common-document-genres.md`](./15-common-document-genres.md) — applies these patterns to specific doc types.
- The five-shape cheat sheet in [`../SKILL.md`](../SKILL.md).
