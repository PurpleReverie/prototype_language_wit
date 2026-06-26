# Faceted content — one source, many views

A single `.wit` document can render as draft notes, final prose,
presentation slides, a public summary, and an internal-only deep
dive. Wit's conditional + iteration + custom-node mechanics combine
to let you write once and gate views.

The principle: tag content with the audiences or contexts it belongs
to, and let conditionals (or the renderer) filter at render time.

## Pattern 1 — Status-gated content

The simplest faceting. A `#doc:` record holds the document's current
status; conditionals show or hide sections accordingly.

```
#doc: { status - draft, audience - internal }

(if @doc.status is draft)
@aside Draft — do not cite. Revision pending. aside@
(end)

(if @doc.audience equals public)
The public-facing summary.
(else)
The internal-only deep dive, with confidential context.
(end)
```

Change one field in `#doc:`; the rendered output changes everywhere
that status / audience matters.

## Pattern 2 — Block annotations on sections

Annotate each section with its audience as data, render only matching
sections.

```
#sections: [
  { id - intro,     title - Introduction,    audiences - [ public, internal ] }
  { id - methods,   title - Methods,         audiences - [ internal ]         }
  { id - findings,  title - Findings,        audiences - [ public, internal ] }
  { id - appendix,  title - Internal Notes,  audiences - [ internal ]         }
]

#current_audience: public

(each @sections as s)
(if @s.audiences contains @current_audience)
@section { id: @s.id, title: @s.title }
~ section body here
section@
(end)
(end)
```

> Note: `contains` as a list-membership operator may not be supported
> in current Wit. The robust shape is a string field (`audience -
> public_internal`) and pattern-matching with `is` / `equals`, OR
> handling the filter in `<% %>` and re-emitting only the surviving
> sections. See [`11-derived-content-recipes.md`](./11-derived-content-recipes.md)
> recipes 4 and 10 for the script form.

## Pattern 3 — Draft notes that disappear in final

Inline draft notes you can leave in the document and hide at publish
time. Use a custom node for the annotation, then a script (or the
renderer) drops them when status is `final`.

```
#doc: { status - draft }

The keeper trimmed the wick @node(type draft_note)
TODO: verify exact time from log entry of 14 March
node@ before the second bell.

<%
if (lh.data.doc.status === 'final') {
  lh.query('node').filter(n => n.params.type === 'draft_note').forEach(n => {
    lh.inject(n.params.injectId, '');   // strip
  });
}
%>
```

Flip `#doc:` to `{ status - final }` and every `draft_note` vanishes
from the rendered output. Prose around the note re-flows naturally.

## Pattern 4 — Slide-only and prose-only content

The same source feeds both a written paper and a talk. Sections gated
to one target or the other.

```
#render_target: paper    ~ flip to `slides` to render the talk

(if @render_target is paper)
@section { title: Introduction }
A long, leisurely introduction that establishes context, names the
question, surveys prior work, and previews the argument.
section@
(end)

(if @render_target is slides)
@node(type slide, title Introduction)
- The question: is attention a form of labour?
- The claim: yes, and the asymmetry is political.
- The plan: three chapters, ending in a conclusion.
node@
(end)

~ Content that appears in both — no gate needed.

@section { title: The argument }
The thesis is that attention, properly understood, is labour.
section@
```

## Pattern 5 — Multiple bibliographies

A document that ships to multiple audiences (academic / general) can
keep two citation styles in the source and select one.

```
#cite_style: chicago    ~ swap to `apa` or `mla`

(if @cite_style is chicago)
reference ./citations/chicago.wit
(end)

(if @cite_style is apa)
reference ./citations/apa.wit
(end)
```

Each citations file defines `#cite` with its own format; the
argument map (`#weil_attention:` etc.) calls `@cite` and renders in
whatever style is current. See
[`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md).

> Caveat: `reference` lines must be at the top of a file before any
> def. Conditional `reference` like the above isn't currently
> supported — the workaround is to have a single style-switching
> reference file that itself dispatches.

## Pattern 6 — Renderer-target dispatch

When the same source renders to multiple targets (HTML for the web,
Markdown for GitHub, LaTeX for print, plain text for Slack), the
renderer can expose a `target` flag to scripts:

```
<%
const t = lh.target;

if (t === 'slack') {
  // Drop asides; flatten lists; shorten headings.
}
if (t === 'print') {
  // Expand collapsibles; add page breaks; insert headers/footers.
}
if (t === 'github') {
  // Skip custom @node(type X) calls the GitHub renderer can't show.
}
%>
```

This requires renderer cooperation. For graceful-degradation patterns
that work even without it, fall back to `@node(type X)` with a
default passthrough; see
[`08-custom-nodes.md`](./08-custom-nodes.md#authoring-tip--portable-vs-renderer-specific).

## Pattern 7 — Public / internal split via build flags

For multi-file documents, the simplest faceting is two root files:

```
public/build.wit:
  reference ../chapters/intro.wit
  reference ../chapters/findings.wit
  ~ omit chapters that aren't public

internal/build.wit:
  reference ../chapters/intro.wit
  reference ../chapters/methods.wit
  reference ../chapters/findings.wit
  reference ../chapters/internal-notes.wit
```

Each root references only the chapters its audience should see.
Chapter files don't need to know which audience they're rendering
for; the root makes the call.

This is the most robust faceting pattern for large documents — no
runtime branching, every published file is fully self-contained, and
the diff between public and internal is visible at the build-file
level.

## Authoring tradeoffs

Faceted content **adds branching to authoring**. The cost is real —
sections you write but never see in any one rendered output, plus
the need to keep gates in sync. Reach for faceting when:

- The same content genuinely serves multiple audiences (academic
  paper + conference talk + blog post).
- Maintaining two separate documents would diverge over time.
- The hidden material is small relative to the shared material.

Avoid faceting when:

- The audiences want substantially different content (rewrite, don't
  branch).
- You're tempted to gate "draft notes" you'll forget about — those
  belong in comments (`~`) instead.

## See also

- [`03-data-records-iteration.md`](./03-data-records-iteration.md) — conditionals and iteration mechanics.
- [`09-self-organising-documents.md`](./09-self-organising-documents.md) — data-driven section ordering pairs naturally with audience gating.
- [`11-derived-content-recipes.md`](./11-derived-content-recipes.md) — recipe 10 (render-target dispatch), recipe 4 (filter/group).
- [`14-citation-styles-and-footnotes.md`](./14-citation-styles-and-footnotes.md) — switching citation style is a special case of faceted content.
