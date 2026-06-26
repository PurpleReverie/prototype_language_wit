# Data, records, conditionals, iteration — full reference

Wit has a built-in static data layer. Records and collections live as
`#name: …` defs, and conditionals + iteration walk them at expand
time. This is what makes a Wit document self-organising: define
chapters as data, the table of contents and the chapter bodies render
from the same source.

## Records `{ k - v, … }`

A set of named values wrapped in `{ }`. Field delimiter is `-`
(hyphen) inside data-def records.

Single-line, comma-separated:

```
#world: { location - Bag End, time - night, storm - true }
```

Multi-line — items one per line, no commas:

```
#keeper_record: {
  name - Aldous Vane
  years at post - 31
  lamp lit - true
}
```

Records nest:

```
#keeper_detailed: {
  name - Aldous Vane
  posted - Dunmore Head
  history { years - 31, incidents - 2 }
}
```

Values can be strings (single or multi-word), numbers, booleans:

```
#report: {
  title - Q3 Operations Review
  pages - 42
  status - final
  draft - false
}
```

> The `:` delimiter is reserved for **record-arg call values**
> (`@card { title: v }`), not for data-def records. See
> [`07-gotchas.md`](./07-gotchas.md#colon-records).

## Collections `[ … ]`

A list of values or records.

Inline list of bare values:

```
#themes: [ attention, perception, moral failure ]
```

Multi-line list of records — items one per line, no commas:

```
#findings: [
  { claim - Attention precedes perception, supported - true,  strength - strong   }
  { claim - Looking is never neutral,       supported - true,  strength - strong   }
  { claim - Attention is a form of labour,  supported - true,  strength - moderate }
]
```

## Data access — dotted paths

Reach into a record with `@name.field`. Nested fields with
`@name.outer.inner`. Bare `@name` renders the whole value.

```
#paper_meta: {
  title - On Attention
  author - { name - Mara Finch, role - lead }
  words - 4200
}

The paper title is @paper_meta.title.
Author: @paper_meta.author.name.
Word count: @paper_meta.words.
```

## Conditionals

Statements wrap in parentheses — they read as asides, never as
instructions. They reference already-defined static data.

Operators: `is`, `equals` (synonym for `is`), `is true`, `is false`.

```
#book_status: { status - draft, audience - external }

(if @book_status.status is draft)
@aside Draft — do not distribute. aside@
(end)
```

With else:

```
(if @author.corresponding is true)
Corresponding author: @author.name
(else)
@author.name
(end)
```

Nested:

```
(if @book_status.status is final)
(if @book_status.audience equals external)
@aside Final, external. aside@
(else)
@aside Final, internal only. aside@
(end)
(end)
```

> Conditionals driven by `::capture::` inside a def body have a known
> parser issue. Prefer data-driven conditionals — see
> [`07-gotchas.md`](./07-gotchas.md#captures-in-conditionals).

## Iteration

`(each @list as item) … (end)`. The loop walks static data — no state,
no mutation, no surprises.

```
#chapters_list: [
  { number - I,   title - The Lamp,     file - one.wit   }
  { number - II,  title - The Voice,    file - two.wit   }
  { number - III, title - The Stranger, file - three.wit }
]

#finding_card ||claim, strength||
::claim:: [::strength::]
finding_card#

(each @chapters_list as ch)
@finding_card |claim @ch.title| |strength @ch.number| finding_card@
(end)
```

(Use pipes with an explicit `name@` close on the same line so the call
stays inside the loop body.)

Conditional inside iteration:

```
(each @chapters_list as ch)
(if @ch.number is II)
@aside chapter two — featured. aside@
(end)
(end)
```

## Tables

Tables build directly on records and collections. Prefer
**schema-array** (the structured form) over inline CSV.

Schema-array — `schema` param names columns, body is a record list:

```
@table |schema name, role|
{ name - Aldous Vane, role - head keeper }
{ name - Mara Finch,  role - inspector   }
table@
```

Schema-record — `from` param references a defined collection:

```
#staff: [
  { name - Aldous Vane, role - head keeper }
  { name - Mara Finch,  role - inspector   }
]

@table |schema name, role| |from @staff|
table@
```

Inline CSV (avoid — prefer schema-array, which keeps the data
structured and compatible with iteration / scripts):

```
@table
| name        | role          |
| ----------- | ------------- |
| Aldous Vane | head keeper   |
| Mara Finch  | inspector     |
table@
```

## The principle

Data drives content. Define chapters / sources / findings as records
or collections once; render the document by iterating and binding.
Don't duplicate the same fact in prose and data — let the data be the
source of truth and the prose be one of its views.

## See also

- [`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md) — `lh.data` exposes every `#thing:` def to JavaScript.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §17–§21, §26 — every record / collection / conditional / iteration / table shape.
