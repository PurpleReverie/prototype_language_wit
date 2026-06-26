---
name: wit
version: 0.1.0
license: MIT
description: Authoring guide for the Wit markup language (.wit files). Activate when editing a .wit file, generating Wit source, answering questions about the Wit language, or building tools (renderers, parsers, integrations) on top of @witlang/parser, @witlang/runtime, @witlang/render-html, @witlang/render-markdown, or @witlang/cli.
---

# Authoring Wit

This is a router. Read the cheat sheet below and you'll write correct,
idiomatic Wit for 80% of tasks. For the other 20%, the manifest at the
bottom points at the right deep-dive file.

## Design principles (in priority order)

1. **Content goes in node bodies. Parameters are metadata.** Never use
   a parameter to carry the content of a node.
2. **Name content as a value-block def** (`#name: … !!`). Refer to it
   from prose with a bare `@name`.
3. **Pass structured params with record-arg + colon** (`{ k: v }`).
4. **For one-line calls with a body, use colon scatter** (`@x k:v x@`).
5. **Decompose long manuscripts with block-form defs** (`#chapter\n...\nchapter#`).
6. **Reserve pipes (`|k v|`) for one case only**: switching a
   parameter mid-body. Everywhere else prefer record-arg or colon
   scatter — the `|` is visually noisy and prone to greedy-bind bugs.

## Cheat sheet — five preferred shapes

Every block below is real Wit. Copy and adapt.

**A. Content def — name a chunk of writing, render it elsewhere.**

```
#epigraph:
The sea does not forgive forgetting.
— coastal proverb
!!

@epigraph
```

**B. Bare reference in prose — for in-text citations.**

```
#weil_attention:
Weil, _Gravity and Grace_ (1952), p. 117.
!!

Attention, as @weil_attention argued, is a moral act.
```

**C. Record-arg with colon delimiter — structured params, no body.**

```
@card { title: Beta, status: draft }
```

Multi-line for complex calls:

```
@card {
  title: Delta
  status: draft
  owner: Mara Finch
}
```

**D. Colon scatter — short one-line call with a body.**

```
@card title:Kappa status:draft card@
```

**E. Block-form def — wrapper for long manuscript sections.**

```
#chapter
...
chapter#

@chapter
A section of prose that fills the splice point.
chapter@
```

## The shape of a Wit file

```
~ comments start with ~ and run to end of line.

reference ./shared/schema.wit    ~ optional cross-file references

#thing: { key - value }          ~ data definitions

#widget ||a, b||                 ~ block-form node definition
@h2 ::a:: h2@
Body content. ...
widget#

~ prose flows freely

@widget                          ~ a node use, form-fill body
  a: hello
  b: world
widget@
```

## The five-form catalog (overview only)

| Form | Shape | When |
|---|---|---|
| Record-arg | `@x { k: v }` | **Preferred default** — structured params, self-closing |
| Colon scatter | `@x k:v x@` | **Preferred for inline** — terse one-line call with body |
| Form-fill body | `@x\n  k: v\nx@` | Multi-param block when no body content |
| Parens | `@x(k v)` / `@x(k: v)` | Self-closing inline, 1–2 short params |
| Pipes | `@x \|k v\|` | **Avoid** — except for mid-body parameter switching |

Deep detail in [`reference/01-invocation-forms.md`](./reference/01-invocation-forms.md).

## What to read when — manifest

**Authoring basics**

| If you're … | Read |
|---|---|
| Picking an invocation form, choosing between record-arg / scatter / pipes | [`reference/01-invocation-forms.md`](./reference/01-invocation-forms.md) |
| Defining a new node, choosing between `#name: !!` and `#name name#` | [`reference/02-defs-and-captures.md`](./reference/02-defs-and-captures.md) |
| Working with records, collections, conditionals, iteration, or tables | [`reference/03-data-records-iteration.md`](./reference/03-data-records-iteration.md) |

**Content patterns**

| If you're … | Read |
|---|---|
| Writing citations, building a bibliography | [`reference/04-citations.md`](./reference/04-citations.md) |
| Building a self-organising document — TOCs, figure lists, see-also sidebars | [`reference/09-self-organising-documents.md`](./reference/09-self-organising-documents.md) |
| Assembling a thesis / book / manual across many files | [`reference/10-document-assembly.md`](./reference/10-document-assembly.md) |
| Rendering one source as multiple views (draft / final / slides / public / internal) | [`reference/12-faceted-content.md`](./reference/12-faceted-content.md) |
| Maintaining a glossary, figures with numbering, or cross-references | [`reference/13-glossary-and-cross-references.md`](./reference/13-glossary-and-cross-references.md) |
| Switching citation styles, doing footnotes, "ibid", multi-source refs | [`reference/14-citation-styles-and-footnotes.md`](./reference/14-citation-styles-and-footnotes.md) |
| Picking the right shape for a specific document type (README, ADR, blog post, meeting notes, recipe, CV, etc.) | [`reference/15-common-document-genres.md`](./reference/15-common-document-genres.md) |
| Reviewing a draft against the do/avoid checklist | [`reference/17-patterns-and-anti-patterns.md`](./reference/17-patterns-and-anti-patterns.md) |

**Scripts**

| If you're … | Read |
|---|---|
| Reaching for `<% %>` — the script bridge / `lh` API | [`reference/05-scripts-lh-bridge.md`](./reference/05-scripts-lh-bridge.md) |
| Looking for a ready-made script recipe (word counts, auto-sort, ibid, etc.) | [`reference/11-derived-content-recipes.md`](./reference/11-derived-content-recipes.md) |

**Renderer integration**

| If you're … | Read |
|---|---|
| Building a custom renderer on `@witlang/runtime` | [`reference/06-custom-renderers.md`](./reference/06-custom-renderers.md) |
| Using formatting beyond core HTML/Markdown (callouts, math, diagrams, footnotes, marginalia, charts) | [`reference/08-custom-nodes.md`](./reference/08-custom-nodes.md) |

**Debugging**

| If you're … | Read |
|---|---|
| Hitting a parse error, debugging an unclosed-node, or a render mismatch | [`reference/07-gotchas.md`](./reference/07-gotchas.md) |

## Examples — tiered

| File | Purpose |
|---|---|
| [`examples/quickstart.wit`](./examples/quickstart.wit) | Smallest correct doc — read first when you've never seen Wit |
| [`examples/preferred.wit`](./examples/preferred.wit) | Realistic mini-document using only the cheat sheet's five shapes |
| [`examples/blog-post.wit`](./examples/blog-post.wit) | Short essay with citations, callouts, pull quotes |
| [`examples/readme.wit`](./examples/readme.wit) | Software project README — metadata, install steps, code blocks |
| [`examples/decision-record.wit`](./examples/decision-record.wit) | Architecture decision record (ADR) with options table |
| [`examples/multi-file-thesis/`](./examples/multi-file-thesis/) | Smallest realistic multi-file layout — root + shared/ + chapters/ |
| [`examples/all-permutations.wit`](./examples/all-permutations.wit) | Exhaustive catalog of every shape with `[PREFERRED]` / `[AVOID]` markers — read only when you need to verify an exact form |

## CLI

```
wit parse path/to/file.wit       # AST as JSON
wit check path/to/file.wit       # validate, exit non-zero on errors
wit build path/to/file.wit -o out.html
wit tour  path/to/file.wit       # narrated walkthrough
```

From a workspace clone: `node packages/cli/dist/bin.js <subcommand> …`.

## When in doubt

1. Prefer a value-block def + bare ref for any named content.
2. Prefer record-arg with `:` for any multi-param call.
3. Prefer block-form defs (`#name … name#`) for long manuscript files.
4. Read the topic-specific reference file before reaching for `<% %>`.
5. Validate with `wit check` before reporting work done.
