# 10-collections — author notes

Collection literals `[ ... ]` (DS-9). Sibling shape to records (M1.09):
same scalar typing, same comma-terminates-item rule, same trailing-comma
tolerance, same empty-container legality. This category ratifies those
record proposals in a different container shape, and lands the
records-inside-collections probe (9.C.2).

Fixtures probe: empty / inline values / multi-word items / inline
records / multi-line values / multi-line records / mixed types /
trailing comma / whitespace-separated / nested. Forbidden-token sweep
(per context-pack section 5): no `@x.y` data access (M1.11), no `(if`
/ `(each` / `is` / `equals` / `else` / `end` (M1.12 / M1.13), no
`reference` keyword (M1.14). Confirmed clean.

## Empty collection legality (PLAN.md I.5)

`empty-collection.wit` is `#themes: [ ]`. Parity with the empty-record
proposal locked in M1.09 (`{ }` legal, `fields: []`). A collection
literal with no items should likewise produce `items: []` rather than
error or null.

**Concrete proposal:** rule (a) — empty collection legal,
`items: []`. Rationale: container-emptiness is a uniform property
across `{}`, `[]`, `()`, `||` (M1.07 capture lists). Treating one
shape's empty form as error while others are legal would surprise
authors and complicate the resolver for no payoff. Same loc rule as
records: collection loc spans `[` through `]`.

## Item scalar typing (PLAN.md I.5)

`mixed-types.wit` is `[ 1, two, true ]`. Locked record decision: eager
scalar — signed decimal int / float → Number; lowercase `true` /
`false` → Bool; else String. No sci notation, no hex, no `Infinity`,
no underscores. Collections inherit verbatim — an item is a value in
the same sense a record field's RHS is a value.

**Concrete proposal:** rule (a) — eager per-item typing identical to
record field RHS. `[ 1, two, true ]` → `[Number(1), String("two"),
Bool(true)]`. Rationale: one scalar grammar across the language;
divergence between record-RHS and collection-item typing would force
the resolver to track context, which the locked I.5 decision
explicitly avoids.

## Multi-word item with internal whitespace (PLAN.md I.4)

`multi-word-items.wit` is `[ moral failure, attention ]` and
`inline-values.wit` includes `moral failure`. Parity with record-RHS
multi-word values: internal whitespace is preserved literally; commas
terminate the item. Same rule applies to parens-form params (M1.05
rule (a) whole-slot) and pipes (M1.06 5.U.1/5.U.2).

**Concrete proposal:** rule (a) — items are whitespace-preserving
String values up to the next comma / newline-as-separator / `]`.
Leading and trailing whitespace per item is stripped (parity with
M1.05 parens-form, M1.06 pipes). Rationale: collections share the
multi-word-value rule with every other container in the language;
re-litigating it here would fragment the grammar.

## Comma terminates item at bracket level (PLAN.md I.4)

`inline-values.wit` and `trailing-comma.wit` exercise the rule that
comma is the item separator. Same rule as record fields (M1.09 I.4
locked: comma always terminates field at brace level). Inside a
nested record `{ a - 1 }` or nested collection `[ ... ]`, the inner
container's own braces / brackets shield commas from the outer
separator.

**Concrete proposal:** rule (a) — comma at bracket-nesting-depth 1
terminates current item. Commas inside nested `{ ... }` or `[ ... ]`
belong to the inner container. Rationale: nesting is the bracketing
discipline already adopted for records; collections must use the same
rule or `[ { a - 1, b - 2 } ]` cannot parse as a single record item.
Matches M1.09's `{ a { b - 1 } }` nested-brace rule.

## Trailing comma tolerance (PLAN.md I.4)

`trailing-comma.wit` is `[ a, b, c, ]`. Parity with M1.09 record
trailing comma (rule (a) tolerated, no empty field) and M1.05 parens
(rule (a) tolerated, no empty slot).

**Concrete proposal:** rule (a) — tolerated, no empty trailing item.
`[ a, b, c, ]` → 3-item collection identical to `[ a, b, c ]`.
Rationale: uniform trailing-comma policy across `{}`, `()`, `[]` is
already the lean across the codebase; collections inherit it.

## Multi-line bracket body — separator semantics (PLAN.md I.15)

`multi-line-values.wit` and `multi-line-records.wit` place each item
on its own line without commas. Parity with the M1.09 I.15 open
question on multi-line records: newline acts as a field separator
inside `{ ... }`. Same rule must apply inside `[ ... ]` or the two
container shapes diverge.

**Concrete proposal:** rule (a) — inside `[ ... ]`, newline and comma
are both item separators; either or both may appear between items;
extra blank lines collapse. Mixed comma + newline (`[ a,\n b ]`) is
legal and produces 2 items. Rationale: matches the I.15 lean for
records and matches how authors will typographically lay out lists;
diverging would penalise readable formatting.

## Whitespace-separated items inside inline brackets (no PLAN.md entry — new I.review item)

`whitespace-separator.wit` is `[ a b c ]` — three identifier-shaped
tokens separated only by spaces, no commas. This is the inline analog
of multi-line-values: if newline-as-separator is legal in block
shape, is space-as-separator legal in inline shape? Two readings: (a)
one item `"a b c"` (multi-word value, no separator); (b) three items
`a`, `b`, `c` (space-as-separator). The multi-word-value rule from
M1.05 / M1.06 / M1.09 is unambiguous for record-RHS / parens / pipes
because each of those has an explicit delimiter (`,`, `)`, `|`).
Collections have a tension: bare space inside `[ ... ]` could be
either.

**Concrete proposal:** rule (a) — bare space is NOT an item
separator inside inline `[ ... ]`. `[ a b c ]` is a single
String item `"a b c"`. Rationale: the multi-word-value rule already
locked for `[ moral failure ]` (one item, two words) cannot coexist
with rule (b) — the parser cannot decide between "multi-word value"
and "space-separated items" without an explicit delimiter. Comma /
newline are the only item separators; the inline space-separated
form is an authoring mistake the resolver should warn on but not
silently re-shape. This fixture documents the surprising case for
the I.review pass.

## Nested collections (PLAN.md I.5)

`nested-collection.wit` is `[ [ 1, 2 ], [ 3, 4 ] ]`. Each outer item
is itself a collection value. Parity with M1.09's nested record value
rule (`{ a { b - 1 } }` — brace value implies no `-` separator).
The analog here: a bracket value implies no separator between
container-open and items.

**Concrete proposal:** rule (a) — collection items may themselves be
collections. Inner `[` opens a nested collection; inner `]` closes
it; commas at the inner bracket-nesting depth belong to the inner
container. No depth limit beyond implementation stack. Rationale:
container nesting is symmetric across `{}` and `[]`; if records can
nest records, collections must be able to nest collections (and
records).

## Records inside collections (PLAN.md I.5)

`inline-records.wit` and `multi-line-records.wit` probe the 9.C.2
row deferred from M1.09: collections of records. Each item is a
record value with its own `{ ... }` body, internal `key - value`
fields, and the locked record rules (comma terminates field,
trailing comma tolerated, eager scalar typing, multi-word values
preserved).

**Concrete proposal:** rule (a) — collection items may be record
values without restriction. `[ { a - 1 }, { a - 2 } ]` produces a
2-item collection where each item is a record. Multi-line form
permits one record per line, no trailing comma required (newline is
separator per the I.15 lean above). Rationale: this is the canonical
"list of structured objects" shape every data language supports;
withholding it would gut the feature. Matches the record-in-param
lean (M1.09 locked: legal, deferred to combinations / review).

## Empty item / `[ , ]` (no PLAN.md entry — new I.review item)

Not fixturised here. Parallel to the empty-record-value question
`{ a - }` (M1.09 lean error). `[ , ]` or `[ a, , b ]` should be
treated identically — empty items between commas are errors, not
String("") or null.

**Concrete proposal:** rule (a) — empty item between commas is
error. Belongs in `tests/errors/` per DS-15 once error codes are
enumerated. Rationale: parity with the empty-record-value lean and
with the trailing-comma rule (one trailing comma tolerated; double
commas are not "two trailing commas", they are an empty middle
item). This is a placeholder for the eventual error fixture.

## Mixed collection of collections + records (no PLAN.md entry — new I.review item)

Not fixturised here. `[ { a - 1 }, [ 2, 3 ], 4 ]` — does a single
collection permit mixed item shapes (record / collection / scalar)?
The mixed-types fixture already proves mixed scalar types are legal;
the question extends to mixed structural shapes.

**Concrete proposal:** rule (a) — yes, mixed structural shapes
legal within one collection. Rationale: Wit is dynamically typed at
the value layer; the locked I.5 eager-scalar rule already accepts
heterogeneous scalars, and there is no value-layer notion of "list
of T". Belongs in `17-combinations/` for explicit coverage.

---

Cross-cuts deferred to later milestones (no open-question status —
purely informational):

- Access path `@x.y` inside a collection item: deferred to M1.11 /
  I.3 access-path-legal-positions.
- Parens-statements (`(if ...)`, `(each ...)`) as item values:
  deferred to M1.12 / M1.13.
- Reference paths as items: deferred to M1.14.
