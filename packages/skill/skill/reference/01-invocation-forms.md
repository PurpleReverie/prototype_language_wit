# Invocation forms — full reference

Wit has six ways to bind named values into a `@node` call. Mixing forms
inside one call is an error. Pick by preference and context:

| Form | Shape | Best for |
|---|---|---|
| **Record-arg** | `@x { k: v }` | Structured params, self-closing — **preferred default** |
| **Colon scatter** | `@x k:v x@` | Short one-line calls with a body — **preferred for inline** |
| **Form-fill body** | `@x\n  k: v\nx@` | Multi-param block calls when no body content |
| **Parens** | `@x(k v)` or `@x(k: v)` | Self-closing inline calls, 1–2 short params |
| **Pipes** | `@x \|k v\|` | Avoid — uglier; one legit use is parameter switching mid-body |

The underlying principle: **content goes in node bodies, parameters are
metadata**. Never use a parameter to carry the content of a node.

## A. Record-arg `{ k: v }` — preferred default

Self-closing — the matching `}` ends the call. No `name@` close, no body
content after. Field name maps directly to capture name.

```
@card { title: Beta, status: draft }
```

Multi-line for complex calls (items one per line, no commas):

```
@card {
  title: Delta
  status: draft
  owner: Mara Finch
}
```

Sits inline mid-sentence (still self-closing):

```
As @cite { author - Weil, year - 1952, page - 42 } argued, attention is rare.
```

Both `:` and `-` work as the field delimiter inside record-arg call
values. Either is fine; `:` reads better when prose-adjacent.

## B. Colon scatter `key:value` — preferred for short inline calls

Single-line body only. `key:value` pairs (no whitespace around `:`) sit
beside prose words. Value runs to the next whitespace.

```
@card title:Kappa status:draft card@
```

Quote multi-word values:

```
@card title:"Lambda Lens" status:draft card@
```

Scattered between prose words:

```
The lamp, @card title:Mu status:draft card@, was relit.
```

Escape a literal colon with `\:`:

```
@card title:name\:Nu status:draft card@
```

## C. Form-fill body

A body where every non-blank line is `<key>: <value>`. Two or more
content lines required; the first must match `<id>:` shape. Use it
when you need many named params and no other body content.

```
@card
  title: Eta
  status: draft
card@
```

A `key:` whose same-line value is empty consumes the indented block
beneath it. Continuation lines must be strictly deeper-indented than
the `key:` line:

```
@card
  title: Eta
  status:
    a longer status running
    across two lines
card@
```

Quoted values survive colons and whitespace:

```
@card
  title: "Theta with: a colon inside"
  status: draft
card@
```

## D. Parens `(k v)` / `(k: v)`

Self-closing. No body. Space-style and colon-style are interchangeable
per pair; you can mix them. Good for one or two short params inside a
sentence.

```
@badge(tone good)
@badge(tone: good, label: Approved)
@badge(tone: good, verified!)
```

Watch for: multi-word colon values across commas confuse parens
parsing (`@x(k: A B, k2: C D)` is fragile). Quote the value or switch
to space-style for that pair.

## E. Pipes `|k v|` — avoid

The `|` is visually noisy and easy to bind greedily wrong (see
[gotchas](./07-gotchas.md)). One case where pipes are best: switching
a parameter partway through a body via pipes scatter — last-wins per
key. Reserve them for exactly that:

```
@scene
|mood calm|
The harbour was still.
|mood tense|
Then the bell began to ring.
scene@
```

Everywhere else, reach for record-arg or colon scatter.

## Param value shapes (inside pipes / parens / record-args)

```
|value|              positional — a single token, no `!`
|key value|          named — first word is key, rest is value (until `|`)
|key - value|        named — hyphen escape when the key itself is multi-word
|flag!|              boolean — trailing `!` marks presence
|multi word flag!|   boolean — `!` works on any length
```

A `!` mid-value is just punctuation, never a flag marker:
`|caption Wow! What a lens|` is a string param.

## See also

- [`02-defs-and-captures.md`](./02-defs-and-captures.md) — how nodes are defined and what captures bind to.
- [`07-gotchas.md`](./07-gotchas.md) — greedy pipes-bind, parens with `@dot.path` values, multi-word colon values.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §10–§15 — every shape, with `[PREFERRED]` / `[AVOID]` markers, parseable.
