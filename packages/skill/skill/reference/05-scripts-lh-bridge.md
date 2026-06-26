# Script bridge — `<% %>` and the `lh` API

`<% js %>` is the escape hatch for anything the declarative model
can't express. Plain JavaScript between `<%` and `%>`, runs once after
the initial document is rendered, via the `lh` bridge object.

Reach for it sparingly — most documents need none. Common cases:
computing summary stats from data, sorting a node-by-class, injecting
a generated section.

## Document-level script blocks

A `<% %>` block at the top level runs once after parse/resolve/expand,
just before render.

```
#findings: [
  { claim - Attention precedes perception, supported - true,  strength - strong   }
  { claim - Looking is never neutral,       supported - true,  strength - strong   }
  { claim - Attention is a form of labour,  supported - true,  strength - moderate }
  { claim - Perception is neutral,          supported - false, strength - contested }
]

#paper: { title - On Attention, word_count - 0 }

@paper-stats paper-stats@

<%
const findings = lh.data.findings;
const supported = findings.filter(f => f.supported === 'true').length;
const pct = Math.round((supported / findings.length) * 100);

const words = lh.prose().wordCount();
lh.set('paper.word count', words);

const order = { strong: 0, moderate: 1, contested: 2 };
lh.sort('finding', (a, b) =>
  order[a.params.strength] - order[b.params.strength]);

lh.inject('paper-stats', `
  @statrow |label Supported|    |value ${supported} of ${findings.length} (${pct}%)| statrow@
  @statrow |label Reading time| |value ~${Math.ceil(words / 200)} min|               statrow@
`);
%>
```

## The `lh` surface

| Call | Returns | Purpose |
|---|---|---|
| `lh.data` | object | All `#thing:` data defs as plain JS objects, keyed by name. |
| `lh.prose()` | helper | `wordCount()`, `text()` over the document's prose nodes. |
| `lh.set(path, value)` | void | Update a value at a dotted path. `path` is `'name.field'` or `'name'`. |
| `lh.sort(name, fn)` | void | Reorder all instances of a node type. `fn` is a standard JS comparator over `{ params, content }` objects. |
| `lh.inject(id, source)` | void | Render Wit source into a node identified by its `id` parameter. The id is set via `@node \|id foo\| node@` on the target. |
| `lh.query(name)` | array | Every node of a given type, as `{ params, content }` objects. |
| `lh.node(id)` | object | A single node by its `id` parameter. |

## Inline `<% %>` inside node bodies

For node-local helpers — usually function declarations consumed by
`@scriptCall(fn)` in the same body.

```
@scene
<% function randomTime() { return new Date().toISOString(); } %>
The train was late @scriptCall(randomTime).
scene@
```

## When to use the bridge (and when not)

**Use it for:**
- Computing aggregates over `#thing:` data (counts, sums, percentages).
- Sorting nodes by a derived order.
- Generating section content from external state at render time.
- Anything that's truly imperative.

**Don't use it for:**
- Conditional rendering — use `(if @x is y)` (see
  [data-records-iteration](./03-data-records-iteration.md)).
- Iteration — use `(each @list as item)`.
- Templating — use captures + `::name::` interpolation
  ([defs-and-captures](./02-defs-and-captures.md)).
- Anything the declarative model already expresses. Keep the document
  scrutable; reach for `<% %>` only when there's no other way.

## See also

- [`03-data-records-iteration.md`](./03-data-records-iteration.md) — the declarative alternatives `<% %>` should never replace.
- [`06-custom-renderers.md`](./06-custom-renderers.md) — custom renderers can extend the `lh` surface for embedded JS.
- [`../examples/all-permutations.wit`](../examples/all-permutations.wit) §22.
