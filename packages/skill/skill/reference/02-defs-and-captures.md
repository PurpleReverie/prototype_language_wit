# Definitions and captures — full reference

A `#name` definition gives a chunk of content (or a template) a name
that prose can reach via `@name`. Three shapes, picked by what the def
holds.

## A. Value-block `#name: … !!` — preferred for content

The greatly preferred shape for named content blocks (citations,
epigraphs, fixed sections, composed inline values).

```
#epigraph:
The sea does not forgive forgetting.
— coastal proverb
!!
```

Reference it with a bare `@name`:

```
@epigraph
```

The body may contain emphasis, composed node calls, anything that
flows in prose:

```
#colophon_line: Set in Inter — © @year, @keeper. !!
```

## B. Block form `#name … name#` — preferred for manuscripts

Preferred when decomposing a long manuscript (thesis, novel, manual)
across files. Each file declares a wrapper; document content flows
through the splice point `...`. The lack of indentation is intentional
— it keeps each file skimmable.

Bare wrapper, no captures, no splice — fixed content:

```
#header
Welcome to the manual.
header#
```

With body splice — the invocation body appears wherever `...` is:

```
#bordered
@aside
~ — top border —
...
~ — bottom border —
aside@
bordered#

@bordered
Body that gets framed by the def's borders.
bordered@
```

With captures + splice — captured params interpolate, body content
splices in:

```
#sectioned ||title||
@h2 ::title:: h2@
...
sectioned#

@sectioned |title Findings|
Three findings emerged from the survey.
sectioned@
```

## C. Single-line `#name: value`

For short string-like values — names, numbers, dates, one-line
composed content. The `:` means "no body".

```
#year: 1923
#place: Dunmore Head
#keeper: Aldous Vane
```

Values can be composed inline node calls:

```
#dateline: Logged on @keeper at @place, @year.
```

## Captures `||a, b, c||` and interpolation `::name::`

Block-form defs may declare captures — named parameters that the
invocation site supplies and the body interpolates.

```
#greet ||name||
Hello, ::name::.
greet#

@greet |name Mara|
```

Multiple captures, repeated interpolation:

```
#chapter_meta ||number, title, year, keeper||
::number:: — ::title:: (::year::, kept by ::keeper::)
chapter_meta#
```

Captures can be passed into nested node uses as param values. For
conditionals driven by captures inside a def, **prefer data-driven
conditionals** — see [gotchas](./07-gotchas.md) on the
capture-in-conditional parser issue.

## Body splice `...`

Three dots on their own line inside a block-form def mark where the
invocation body is rendered. Omit it if the node takes no body.

A def with captures but no `...` will silently drop any body passed at
the call site — useful for defs that are pure interpolation.

## Additive partials `+#name:`

A leading `+` on a single-line def contributes to a partial that
merges across files. Useful for assembling a bibliography from
multiple chapter files. Each file adds entries; the final `#name` is
the merged set.

```
+#bibliography: @entry Berger, Ways of Seeing (1972). entry@ !!
+#bibliography: @entry Weil, Gravity and Grace (1952). entry@ !!
```

## See also

- [`04-citations.md`](./04-citations.md) — the citation pattern uses all three def shapes together.
- [`07-gotchas.md`](./07-gotchas.md) — the single-line-def-with-captures rendering bug and the capture-in-conditional issue.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §5–§9 — every def + capture shape.
