# Derived content recipes — ready-made `<% %>` patterns

The `<% %>` script bridge ([`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md))
exposes the runtime's data and node queries via the `lh` object. This
file is the cookbook — concrete recipes for the patterns documents
need most often. Copy, adapt, ship.

For when not to reach for `<% %>`, see the bottom of
[`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md#when-to-use-the-bridge-and-when-not).

## Recipe 1 — Word count + reading time

Compute the document's word count, derive an estimated reading time,
and inject both into a node by id.

```
#reading_time: 0

@reading-stats reading-stats@

<%
const words = lh.prose().wordCount();
const minutes = Math.max(1, Math.ceil(words / 200));
lh.inject('reading-stats', `
  @meta |label Word count| |value ${words}| meta@
  @meta |label Reading time| |value ~${minutes} min| meta@
`);
%>
```

The `@reading-stats reading-stats@` empty node is the injection
target. The renderer needs to support an `id` attribute on
`@reading-stats` for `lh.inject('reading-stats', …)` to find it —
this is convention, not enforced.

## Recipe 2 — Auto-sort findings by strength

Reorder all `@finding` nodes by a strength priority before render.

```
#findings: [
  { claim - Attention precedes perception, strength - strong   }
  { claim - Looking is never neutral,       strength - moderate }
  { claim - Attention is a form of labour,  strength - contested }
  { claim - Perception is neutral,          strength - strong   }
]

(each @findings as f)
@finding |claim @f.claim| |strength @f.strength| finding@
(end)

<%
const order = { strong: 0, moderate: 1, contested: 2 };
lh.sort('finding', (a, b) =>
  order[a.params.strength] - order[b.params.strength]);
%>
```

`lh.sort(name, fn)` reorders every instance of the named node in
place. Authors write in narrative order; the script sorts to display
order.

## Recipe 3 — "X of Y supported" summary badge

A boolean-aggregating script that emits a summary node.

```
#findings: [
  { claim - …, supported - true,  strength - strong }
  { claim - …, supported - true,  strength - strong }
  { claim - …, supported - false, strength - contested }
]

@summary-badge summary-badge@

<%
const all = lh.data.findings;
const ok = all.filter(f => f.supported === 'true').length;
const pct = Math.round((ok / all.length) * 100);
lh.inject('summary-badge', `
  @badge tone:good ${ok} of ${all.length} findings supported (${pct}%) badge@
`);
%>
```

Note: record boolean values render as the strings `'true'` /
`'false'` in `lh.data`. Compare against the string.

## Recipe 4 — Filter and group records

Split a flat collection into groups for sectioned rendering.

```
#tasks: [
  { title - Trim wick,      status - done,   owner - Aldous }
  { title - Replace lens,   status - todo,   owner - Mara   }
  { title - Inspect bell,   status - done,   owner - Aldous }
  { title - Log conditions, status - todo,   owner - Mara   }
]

@by-owner by-owner@

<%
const groups = {};
for (const t of lh.data.tasks) {
  (groups[t.owner] ??= []).push(t);
}
const rendered = Object.entries(groups).map(([owner, tasks]) => `
  @h3 ${owner} h3@
  @ul
  ${tasks.map(t =>
    `@li ${t.title} [${t.status}] li@`
  ).join('\n')}
  ul@
`).join('\n');
lh.inject('by-owner', rendered);
%>
```

## Recipe 5 — Auto-numbered figures + backrefs

Walk the document, assign figure numbers in traversal order, rewrite
`figref` calls to "Fig. N" backreferences.

```
<%
const figs = lh.query('node').filter(n => n.params.type === 'figure');
const idToNumber = {};
figs.forEach((f, i) => { idToNumber[f.params.id] = i + 1; });

lh.query('node')
  .filter(n => n.params.type === 'figref')
  .forEach((ref) => {
    const num = idToNumber[ref.params.target];
    lh.inject(ref.params.injectId, num ? `Fig. ${num}` : '?');
  });
%>
```

For this to work the renderer needs to expose stable per-node
injection ids; consult your renderer's docs. Pure-data alternatives
(maintaining the counter in `lh.data` and reading it during render)
work too.

## Recipe 6 — "Ibid" footnote consolidation

When consecutive citations refer to the same source, replace later
ones with "ibid." This is a render-pass transformation.

```
<%
const cites = lh.query('node').filter(n => n.params.type === 'cite');
let prev = null;
cites.forEach((c) => {
  if (prev && prev.params.source === c.params.source) {
    lh.inject(c.params.injectId, 'ibid., p. ' + c.params.page);
  }
  prev = c;
});
%>
```

## Recipe 7 — Generate a TOC from headings

Walk every `@h2` / `@h3` after expand; assemble a list with anchored
links.

```
@toc toc@

<%
const headings = lh.query('h2').concat(lh.query('h3'));
const items = headings.map((h, i) => {
  const text = h.content;
  const id = h.params.id ?? `h-${i}`;
  const level = h.kind ?? 'h2';
  const indent = level === 'h3' ? '  ' : '';
  return `${indent}@li @a |href #${id}| ${text} a@ li@`;
});
lh.inject('toc', `@ul\n${items.join('\n')}\nul@`);
%>
```

Pure-data alternative: define your sections as a record collection
(see [`09-self-organising-documents.md`](./09-self-organising-documents.md))
and render both the TOC and the bodies declaratively. The recipe
above is for documents whose headings are written inline as prose.

## Recipe 8 — Cross-reference resolution

Resolve `@node(type ref, target X)` calls to the human-facing label
of the referenced node.

```
<%
const sections = lh.query('section');
const labels = {};
sections.forEach((s) => {
  labels[s.params.id] = s.params.title;
});

lh.query('node')
  .filter(n => n.params.type === 'ref')
  .forEach((ref) => {
    const label = labels[ref.params.target] ?? '???';
    lh.inject(ref.params.injectId, `“${label}”`);
  });
%>
```

## Recipe 9 — Bibliography backrefs

For each source in the bibliography, list every section that cites
it.

```
<%
const citeUses = lh.query('node').filter(n => n.params.type === 'cite');
const bySource = {};
citeUses.forEach((c) => {
  (bySource[c.params.source] ??= []).push(c.params.section);
});

lh.query('node')
  .filter(n => n.params.type === 'bib_entry')
  .forEach((entry) => {
    const refs = bySource[entry.params.id] ?? [];
    const backrefs = refs.map(s => `@a |href #${s}| §${s} a@`).join(', ');
    lh.inject(entry.params.backrefsInjectId,
      refs.length ? `Cited in: ${backrefs}` : '');
  });
%>
```

## Recipe 10 — Conditional content based on render target

Different renderers can set a `target` global; scripts gate content
on it.

```
<%
const target = lh.target ?? 'html';

if (target === 'slack') {
  lh.query('node').filter(n => n.params.type === 'aside').forEach(a => {
    lh.inject(a.params.injectId, '');  // strip asides in Slack
  });
}

if (target === 'print') {
  lh.query('node').filter(n => n.params.type === 'collapsible').forEach(c => {
    lh.inject(c.params.injectId, c.content);  // expand collapsed sections
  });
}
%>
```

For faceted-content patterns more generally, see
[`12-faceted-content.md`](./12-faceted-content.md).

## A note on injection ids

Several recipes above assume the renderer exposes per-node injection
ids — a stable handle each node has that you can target with
`lh.inject(id, source)`. The reference renderers in this repo expose
an `id` param (e.g. `@my-target my-target@ then lh.inject('my-target',
…)`). Custom renderers may differ; check the renderer's API.

When in doubt, use the declarative path: define your structure as
data ([`09-self-organising-documents.md`](./09-self-organising-documents.md))
and render via iteration. Scripts are for the cases iteration can't
cover.

## See also

- [`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md) — the `lh` surface.
- [`03-data-records-iteration.md`](./03-data-records-iteration.md) — declarative alternatives to most of these recipes.
- [`08-custom-nodes.md`](./08-custom-nodes.md) — the renderer-side dispatch these scripts produce content for.
- [`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md) — "ibid" and footnote-renumbering recipes in citation-specific form.
