# tests/integration — notes

These fixtures are the spec PDF's "Worked examples" section (pp. 15-26)
migrated to the current locked Wit syntax. Each file is a realistic,
document-scale composition exercising many features together. Unlike the
unit fixtures under `tests/fixtures/NN-*/`, these documents are not
sliced by syntax category — they are end-to-end and exist to stress
*interactions* between features.

## Migration: spec PDF → current locked syntax

The spec PDF predates several locked decisions. Every fixture in this
directory had to migrate at least one form:

- **Comments.** Spec PDF uses `\- ... -\` for both line and block
  comments. Current locked syntax (per `tests/fixtures/03-comments/`
  and `examples/03-comments.wit`) is `~ ...` for line comments and
  `~~ ... ~~/` for inline/block comments. All `\- ... -\` runs in the
  spec source were migrated to `~ ...` line comments here, since they
  function as section dividers and headers in the original.
- **Complex value blocks.** Spec PDF uses `! ... !` as the delimiter
  for multi-line / complex `#name:` values (e.g. the citation schema).
  Current locked syntax (per `examples/08-single-line-defs.wit` and
  `examples/09-citations.wit`) is `: ... !!` — a leading colon to
  introduce the body, `!!` to terminate. Every spec-PDF `! ... !`
  was rewritten to `: ... !!`.
- **Parameter key/value separator.** Spec PDF mostly writes
  `|key - value|` (hyphen always). Current locked syntax (per
  `examples/05-parameters.wit`) is `|key value|` for single-word keys
  and reserves `|key - value|` for multi-word keys only. Single-word
  keys were demoted to plain space-separated form here. Multi-word keys
  (e.g. `|background colour - dark slate|`) keep the hyphen.
- **Record field separator.** Inside `{ ... }` records the spec PDF
  uses `key - value` consistently. That matches the current locked
  form for records (see `examples/10-records.wit`), so record bodies
  were not changed.
- **Conditional operator.** Spec PDF writes `(if ::met:: = true)` and
  `(if @x.y = z)` with `=`. Current locked syntax (per
  `examples/13-conditionals.wit`) is `(if @x.y is z)` or
  `(if @x.y equals z)`. Every `=` in a statement was rewritten to `is`.

No new syntax was introduced. Where the migration produced an awkward
phrasing (multi-word keys with hyphens vs single-word without), the
result still parses under one locked rule, never two.

## report.wit (no PLAN.md entry — new I.review item)

Spec PDF pp. 15-17. Categories exercised: 01 (prose), 02 (emphasis —
none in this one, intentional: reports stay plain), 03 (line comments),
04 (using nodes), 05 (parameters — pipes, named, flags via `met true`
on metric data), 07 (defining `#metric`), 10 (records — `#report`),
11 (collections — `#metrics`, `#sites` as record lists), 12 (accessing
data — `@report.title`, `@m.label`, `@site.inspected`), 13
(conditionals — both `(if @report.status is draft)` and the nested
`(if ::met:: is true)` inside the `#metric` definition), 14 (iteration
over `@metrics` and `@sites`).

Novel combination for this fixture: a captured parameter (`::met::`)
used as the operand of a conditional inside a node *definition*, not
on already-defined static data. The `examples/13-conditionals.wit`
fixture only exercises conditionals against `@thing.field` paths.
Reviewer should confirm this is in-scope under the locked semantics
of conditionals; if not, this is an open item for I.review.

**Concrete proposal:** treat `(if ::param:: is X)` inside a `#name`
definition body as a deferred evaluation — the conditional resolves
when the definition is invoked with concrete params. Same surface
syntax as the data-access form, just bound later. Rule (a).

## blog-post.wit (no PLAN.md entry — new I.review item)

Spec PDF pp. 17-19. Categories: 01, 02 (`_write_`, `*and*` in the same
paragraph), 03 (line comment), 04 (`@callout`, `@pullquote`, `@figure`,
`@h1`, `@h2`, `@tag`), 05 (named params, including multi-word `|src
desk.jpg|` etc.), 10 (`#post`), 11 (`#tags`), 12 (`@post.title` used
twice — once as a parameter value, once as a node body), 14 (iteration
over `@tags`).

Novel combination: a `@code |language wit|` node containing literal Wit
source as its body. This is interesting because the body bytes
*look like* Wit (they contain `#weil_attention:` and `@weil_attention`)
but are inert prose under the locked rules — a code block is just
another node whose body is opaque text. Reviewer should confirm there
is no auto-interpretation of node-body content based on a `language`
parameter.

**Concrete proposal:** `@code` is no different from any other node.
Parameters are metadata; the body parses by the same rules whether
the code is Wit, JS, or English. Renderers may syntax-highlight, but
the parser must not switch grammars. Rule (b).

## academic-article.wit (no PLAN.md entry — new I.review item)

Spec PDF pp. 19-21. Categories: 01, 02 (none — academic prose stays
plain), 03, 04 (`@article`, `@abstract`, `@h1`, `@note` as an inline
footnote, `@theorem`, `@figure`, `@bibliography`), 05 (pipes for
`@article` open params, named multi-word `|caption The dual
structure...|`), 07 (defining `#cite` and `#theorem`), 08 (single-line
defs — `#weil:`, `#berger:`, `#arendt:` as multi-line `: ... !!`
values; and the argument-map handles `#weil_attention:` etc.), 09
(citations — the whole argument-map pattern).

Novel combination: `@fig-model` (a bare reference with a hyphen in
the name) used mid-sentence to backref the `|id fig-model|` parameter
of the earlier `@figure`. This implicitly assumes node-id lookup
across the document and resolution of hyphenated handles. Reviewer
should confirm.

**Concrete proposal:** hyphens inside a node-handle (after `@`) are
allowed; the parser treats `@fig-model` as a single reference token.
`@fig` followed by `-model` would require whitespace between them.
Rule (a).

## book-manuscript/ (no PLAN.md entry — new I.review item)

Spec PDF pp. 21-22. Multi-file: `master.wit`, `shared/schema.wit`,
`shared/sources.wit`, `chapters/one.wit`, `chapters/two.wit`.
Categories: 03, 04, 05, 07, 08, 09 (citations resolved across files),
10 (`#book`), 13 (`(if @book.status is draft)` in the master), 15
(`reference` directives — composition across files), 16 (additive
partials — `+#toc:` and `+#bibliography:` in each chapter file).

Novel combination: a chapter file declares both an additive partial
(`+#bibliography:`) *and* a normal definition (`#chapter_one`) in the
same file, and the master file then references it. The interaction
between `reference` and `+#name` is what makes the table of contents
fill itself.

The spec PDF's example puts the chapter's `+#bibliography:` on the
same line as the citation entry, after a single space. Mirrored that
here. Reviewer should confirm whether `+#bibliography: <body> !!` and
`+#bibliography:\n<body>\n!!` are equivalent — they should be, but the
locked rules in `examples/16-additive-partials/` only show the
single-line form.

**Concrete proposal:** `+#name:` accepts the full range of value
shapes that `#name:` accepts (single-line, multi-line `: ... !!`,
record, collection). Additive merging happens at the level of the
final resolved value, not at the syntactic level. Rule (a).

## film-script.wit (no PLAN.md entry — new I.review item)

Spec PDF pp. 22-24. Categories: 03, 04 (`@scene`, `@action`, `@cue`,
`@paren`, `@transition`), 05 (named params, including multi-word
`|location - INT. LIGHTHOUSE — LANTERN ROOM|`), 07 (defining `#scene`
and `#cue` with captured params).

Novel combination: a parameter value containing an em-dash (`—`) and
an unbalanced delimiter character (the `INT.` period, the all-caps
words). The pipe-delimited value is read literally to the closing `|`,
so neither the em-dash nor the period is special. The fixture is
intentionally a stress test of "what counts as the end of a parameter
value." Reviewer should confirm that *only* a literal `|` (not inside
an escape) terminates the value.

**Concrete proposal:** the parameter value runs from the first
non-space byte after the key (or after the leading `|` for positional)
to the next unescaped `|`. Em-dashes, periods, ALL CAPS, parentheses
in prose form — none of these terminate the value. Rule (a).

## rpg-script.wit (no PLAN.md entry — new I.review item)

Spec PDF pp. 24-26. Categories: 03, 04 (`@scene`, `@choices`, `@choice`,
`@say`, `@goto`), 05 (named params throughout), 07 (defining `#say` with
captured `::who::` and `::mood::`), 10 (`#frodo`, `#gandalf`, `#world`
state records), 13 (gating conditionals — `(if @frodo.knowledge is
high)`, `(if @world.sauron_knows is true)`).

Novel combination: deeply nested `@choices > @choice > @choices >
@choice` (four levels), interleaved with `(if …)` gating blocks. The
spec PDF example also uses `world.sauron knows` (with a space) as a
key, which under the locked record rules requires the multi-word
hyphenated form `sauron knows`. The migration kept the space inside
the record but accesses it via `@world.sauron_knows` — the fuzzy-match
rule in `examples/12-accessing-data.wit` covers this case explicitly.

The spec PDF additionally writes `@goto |scene - what-must-be-done|`
with a hyphen between `scene` and the value. Since `scene` is a
single-word key, that has been demoted here to `|scene
what-must-be-done|`. The internal hyphens of the value
(`what-must-be-done`) are just bytes inside the value and are
preserved.

**Concrete proposal:** key-to-value separator is a single space for
single-word keys; the ` - ` separator is reserved for *keys* that
contain spaces. Hyphens inside values are content, not syntax. Rule
(a).
