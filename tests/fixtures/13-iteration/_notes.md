# 13-iteration fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the `(each @collection as item) ... (end)` loop construct.
Iterates over collections of values or records. Inside the body,
the loop variable is referenced as `@<itemName>` and (for record
items) as `@<itemName>.<field>`. Bodies may contain other nodes,
parameters (pipes), and nested conditionals or other loops.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line; all explanatory text lives in this file.

## Loop variable shadowing (no PLAN.md entry — new I.review item)

`item-name-shadowing.wit` defines a top-level `#item` and then
uses `as item` inside `(each @items as item) ...`. Cross-refs:
DS-12 (iteration), DS-1 (definitions). Two readings:

- (a) Inside the body, `@item` always resolves to the loop
  variable; the outer `#item` is shadowed until `(end)`.
- (b) Loop variable lives in a separate namespace from
  `#`-prefixed definitions and never shadows.
- (c) Collision is an authoring error (warning at parse time).

**Concrete proposal:** (a) — lexical shadowing within the body
matches the principle of least surprise for nested scopes and
makes loop bodies relocatable without renaming. Outer `#item`
remains visible again after `(end)`.

## Empty-body legality / no-op semantics (no PLAN.md entry — new I.review item)

`empty-body.wit` has `(each @themes as item) (end)` with nothing
between the open and `(end)`. Cross-ref: DS-12, W.empty-bodies.
Two readings:

- (a) Legal. The loop runs N times producing no output; useful
  if the body is later filled in or used for parser-level
  iteration without rendering.
- (b) Illegal — the parser rejects empty iteration bodies as
  an authoring smell, parallel to whatever rule
  `12-conditionals/empty-then-body.wit` settles on.

**Concrete proposal:** (a) — empty body is legal and produces
no output per iteration. Stay symmetric with whatever
12-conditionals decides for empty `then`/`else`; if that lands
on "illegal", revisit this in I.review.

## Iteration order preservation (no PLAN.md entry — new I.review item)

`iteration-order-preservation.wit` iterates an 8-item collection
where bell-numbers must render in source order. Cross-ref: DS-12,
DS-9 (collections). The question is whether the spec *guarantees*
source order or merely happens to do so today.

- (a) Source order is a guaranteed, normative property of
  `(each)`. Collections are ordered sequences, not sets.
- (b) Order is unspecified; renderers MAY reorder.

**Concrete proposal:** (a) — collections in 10-collections are
already authored and read as ordered lists; iteration must
preserve that. Codify as an explicit guarantee.

## Loop variable scope (no PLAN.md entry — new I.review item)

Does `@item` remain bound after `(end)`? Cross-ref: DS-12.

- (a) Body-only. After `(end)` the name reverts (to its outer
  binding if any, otherwise unresolved).
- (b) Leaks past `(end)` with the value of the final iteration.

**Concrete proposal:** (a) — body-only. (b) couples loops to
their trailing context and complicates `end-token-pairing.wit`,
where two consecutive `(each ... as item)` loops would otherwise
have the first's terminal value visible between them.

## Nested-each variable visibility (no PLAN.md entry — new I.review item)

In `nested-each.wit`, the inner loop uses `@deck.hands` from the
outer item and binds its own `as hand`. The reading question:

- (a) Inner body sees both `@deck` (outer) and `@hand` (inner).
  Loop variables stack lexically.
- (b) Inner shadows outer if the names collide; otherwise both
  are visible.

**Concrete proposal:** (a) with (b)'s shadowing rule as a
corollary — lexical stacking, inner name wins on collision.
This is the standard nested-scope reading and matches the
shadowing proposal above.

## Item access syntax (no PLAN.md entry — new I.review item)

`each-over-records.wit` and `body-with-params.wit` write
`@item.name` with no space around the dot. Cross-ref: DS-11
(data access), DS-12.

- (a) `@item.field` is a single reference token; whitespace
  around the dot is forbidden.
- (b) `@item .field` and `@item. field` are also legal,
  treated identically.
- (c) Dotless `@item field` is the named-param shape from
  06-parameters-pipes and must not be confused with access.

**Concrete proposal:** (a) — tight, no whitespace around the
dot. This keeps `@item.field` unambiguous against the pipe
named-param shape `|key value|` and against bare-positional
slots.

## End-token-pairing — LIFO discipline (no PLAN.md entry — new I.review item)

`end-token-pairing.wit` has two sibling `(each)`/`(end)` pairs
on one paragraph; `nested-each.wit` and `each-with-if.wit` have
nested pairs. Cross-ref: DS-12, DS-conditionals (12).

- (a) Strict LIFO: every `(end)` closes the most recently
  opened block-form node, regardless of kind (`each` or `if`).
- (b) Typed `(end)` — `(end each)` / `(end if)` — required
  when nesting heterogeneous block forms.

**Concrete proposal:** (a) — strict LIFO, untyped `(end)`.
Matches the surface used by 12-conditionals fixtures (plain
`(end)`) and keeps the language compact. If author error rates
prove high, revisit (b) as an optional disambiguator in
I.review.

## Authoring invocations

All fixtures authored as plain LF-terminated UTF-8 via the
editor. No byte-sensitive cases (CRLF, bare CR, BOM,
no-trailing-LF) in this category — those belong to
`00-lexical/`.
