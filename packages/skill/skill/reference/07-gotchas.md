# Gotchas — parser edge cases you will hit

The traps below are concrete patterns that produce confusing errors
or silently parse to the wrong thing. Each is reproducible and worth
recognising on sight.

## Greedy pipes-bind

`@x |…|` with no `x@` close on the same line greedily binds to the
NEXT `x@` it finds — possibly across many lines and other nodes.

```
@cite |author Weil|         ~ no `cite@` on this line; opener stays open

…

@cite                       ~ this opener gets sucked into the one above
  author: Berger
cite@                       ~ closes the first @cite, not this one
```

**Fix.** Use a self-closing form (parens, record-arg), or add an
explicit `x@` on the pipes line. When demonstrating multiple
invocations of the same node in a single file, put self-closing pipes
LAST so they can't eat a later block use.

## Single-line def + `||captures||` + invocation prints the capture list

Confirmed via probe:

```
#cite: ||author, year|| ::author:: (::year::) !!
@cite |author Smith| |year 2024|
```

…renders the literal string `"author, year Smith (2024)"` instead of
the substituted citation. **Use block form** for any def that takes
captured params:

```
#cite ||author, year||
::author:: (::year::)
cite#
```

## Form-fill body needs ≥ 2 content lines

A body with only one `key: value` line is treated as prose. Form-fill
detection requires two or more non-blank, non-comment content lines
with the first matching `<id>:` shape.

```
@card
  title: only_one
card@
```

The `title: only_one` ends up as prose, not a field. Add a second
field or switch to record-arg / colon-scatter.

## `E_MIXED_PARAM_SOURCE`

You opened with one form and tried to add a param using another:

```
@card | title Beta | { status: draft }     ~ pipes then record-arg
@card(title Beta)                          ~ then a body — parens are self-closing
```

The form you open with is the form that closes the call. Don't mix.

## Form-fill multi-line value indent rule

A `key:` whose same-line value is empty consumes the indented block
beneath it. Continuation lines must be **strictly deeper** indented
than the `key:` line. Lines at the same indent are treated as the
next field, not continuation.

```
@card
  status:
    a continuation              ~ deeper than `status:` — kept as value
  end                           ~ same indent — this is a new (broken) field
card@
```

## <a name="colon-records"></a>Colon-delim records — call sites only

Both single-line and multi-line records inside `#name: { … }` data
defs MUST use `-` (hyphen) as the field delimiter. The colon variant
parses inconsistently across the CLI and the LSP (CLI accepts, LSP
rejects with `E_MALFORMED_RECORD`).

```
#world: { location - Bag End, time - night }      ~ ok
#world: { location: Bag End, time: night }        ~ LSP rejects
```

The `:` form IS valid inside **record-arg call values** (`@card { k:
v }`), just not inside data-def records. See
[`01-invocation-forms.md`](./01-invocation-forms.md#a-record-arg).

## `@dotted.path` inside parens param values

`@thing.field` inside a parens or record-arg value can confuse the
parens close detection — the parser sees `@` and tries to parse a
node use, which fails when the parens close comes early.

```
~ Inside iteration — the @ch.title triggers the issue
(each @chapters as ch)
@card_v2(title @ch.title, status draft)         ~ LSP rejects
(end)
```

**Fix.** Use pipes or form-fill body for these calls instead — they
handle `@path` values without ambiguity:

```
(each @chapters as ch)
@card_v2 |title @ch.title| |status draft| card_v2@
(end)
```

## Multi-word colon values in parens

`@x(k: A B, k2: C D)` — colon-style with multi-word values across
commas — breaks parens parsing. The parser can't tell where one value
ends and the next pair begins.

**Fix.** Quote the value, or switch the multi-word pair to space-style:

```
@x(k: "A B", k2: "C D")                          ~ quoted
@x(k A B, k2 C D)                                ~ space-style
```

## <a name="captures-in-conditionals"></a>`(if ::capture::)` inside a def body

A conditional that branches on a captured param INSIDE the def's body
hits a parser issue today — the surrounding `@wrapper` looks unclosed.

```
#wrap ||urgent||
@aside
(if ::urgent:: is true)
urgent!
(end)
aside@
wrap#
```

This is currently broken. **Workaround.** Drive the conditional from
**data** instead of captures (define a `#status: { ... }` record and
branch on its fields), or invoke a different def per branch from the
call site.

## LSP vs CLI parser divergence

The bundled VS Code language server applies a slightly stricter
ruleset than `wit check` in a few spots (colon-delim records and some
parens close cases). If `wit check` is happy but the IDE shows red
squiggles, the file will RENDER fine, but readers using the IDE will
see confusing errors. The safest set of patterns is the intersection
— what both accept. Stick with the shapes shown in the cheat sheet
and you'll never hit this.

## See also

- [`01-invocation-forms.md`](./01-invocation-forms.md) — the form-by-form rules these gotchas violate.
- [`02-defs-and-captures.md`](./02-defs-and-captures.md) — block-form vs single-line def, when each works cleanly.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) — every snippet there is verified to parse with `wit check`.
