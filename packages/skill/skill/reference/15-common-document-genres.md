# Common document genres — patterns for the doc types you'll write

When an agent is asked to "write a README" or "draft an ADR" or
"convert this page to Wit", the first question is: what shape does
this genre take? This file maps each common genre to its load-bearing
Wit features and points at a worked example where one exists.

## README

A software project's introductory document.

**Shape.** Project metadata (name, tagline, version), a brief intro,
install / usage / status / license sections, code blocks for shell
commands and sample usage.

**Load-bearing features.**
- `#meta:` record with project metadata, referenced via `@meta.field`.
- Wrapped custom nodes for code blocks (`#code ||lang||`) and callouts (`#info`).
- Core vocab `@h1`, `@h2`, `@ul`, `@li`, `@a`.

**Worked example.** [`examples/readme.wit`](../examples/readme.wit).

## Blog post / essay

A short, prose-heavy piece, often with citations and callouts.

**Shape.** Title and metadata, intro paragraph, body with inline
citations or callouts, optional pull quote, conclusion.

**Load-bearing features.**
- Value-block defs for citations (the argument-map pattern from
  [`04-citations.md`](./04-citations.md)).
- Wrapped custom nodes for callouts and pull quotes.
- Italic + bold inline emphasis.

**Worked example.** [`examples/blog-post.wit`](../examples/blog-post.wit).

## Decision record (ADR)

A structured record of an architectural or organisational decision.

**Shape.** Number, title, status, date, authors. Sections for
context, options considered, decision, consequences.

**Load-bearing features.**
- `#adr:` record with metadata.
- A `#options:` collection rendered as a schema-array table.
- Callouts (`#info`, `#warn`) to flag risks or follow-ups.

**Worked example.** [`examples/decision-record.wit`](../examples/decision-record.wit).

## Meeting notes

Notes from a meeting plus action items.

**Shape.** Date and location metadata, attendees as a collection,
agenda items as records, decisions log, action items with owner and
due date.

**Load-bearing features.**
- Multiple parallel collections — attendees, agenda, decisions, actions.
- Schema-array tables for agenda and actions.
- Iteration with conditional formatting per status.

**Sketch.**

```
#meeting: { date - 2026-03-14, location - lighthouse }

#attendees: [ Mara, Aldous, Trinity-rep ]

#agenda: [
  { item - Lamp inspection schedule, owner - Aldous, status - decided }
  { item - Logbook digitisation,     owner - Mara,   status - pending }
]

#actions: [
  { task - Order replacement wicks, owner - Aldous, due - 2026-03-21 }
]

@h1 Keeper's Meeting — @meeting.date h1@

Attending:

@ul
(each @attendees as a)
@li @a li@
(end)
ul@

@h2 Agenda h2@
@table |schema item, owner, status| |from @agenda|
table@

@h2 Action items h2@
@table |schema task, owner, due| |from @actions|
table@
```

## Recipe / how-to

A list of ingredients plus ordered steps, plus variations.

**Shape.** Title, intro, ingredients as a record collection, steps
iterated in order, variations and related recipes.

**Load-bearing features.**
- `#ingredients:` collection of records (item + quantity).
- `(each)` iteration over numbered steps.
- Cross-refs to related recipes via custom nodes.

**Sketch.**

```
#recipe: { title - Lighthouse stew, serves - 4, time - 90 min }

#ingredients: [
  { item - butter,   qty - 50g  }
  { item - onion,    qty - 1    }
  { item - potatoes, qty - 500g }
  { item - stock,    qty - 1L   }
]

#steps: [
  Melt the butter; soften the onion until translucent.,
  Add the cubed potatoes; toss to coat.,
  Pour in the stock; simmer for 45 minutes.,
  Season; serve with bread.
]

@h1 @recipe.title h1@

Serves @recipe.serves · @recipe.time

@h2 Ingredients h2@
@table |schema item, qty| |from @ingredients|
table@

@h2 Method h2@
@ol
(each @steps as step)
@li @step li@
(end)
ol@
```

## Changelog

A versioned log of changes to a project.

**Shape.** Project name and current version, one section per release,
type-grouped changes (added / changed / fixed / removed) per release.

**Load-bearing features.**
- `#versions:` collection with one record per release.
- Nested iteration — outer over versions, inner over change groups.
- Cross-refs to PR / issue numbers (custom nodes).

**Sketch.**

```
#versions: [
  { version - 1.2.0, date - 2026-03-14,
    added - [ Form-fill body parser ., New @code wrapper for project use . ],
    fixed - [ Greedy pipes-bind in nested defs . ]                          }
  { version - 1.1.0, date - 2026-02-28,
    changed - [ @cite schema now requires a year . ],
    removed - [ Legacy XML output renderer . ]                              }
]

@h1 Changelog h1@

(each @versions as v)
@h2 @v.version — @v.date h2@

@h3 Added h3@
@ul
(each @v.added as item)
@li @item li@
(end)
ul@

@h3 Fixed h3@
@ul
(each @v.fixed as item)
@li @item li@
(end)
ul@
(end)
```

## CV / bio

A personal summary plus structured timeline.

**Shape.** Name and contact metadata, summary paragraph, sections for
experience, education, skills — each a collection of records.

**Load-bearing features.**
- `#person:` metadata record.
- Multiple parallel collections (experience, education, skills).
- Iteration with subheadings per item.

**Sketch.**

```
#person: {
  name - Mara Finch
  email - mara.finch@example.org
  location - Coastal Cornwall
  headline - Senior keeper, attention researcher
}

#experience: [
  { role - Senior Keeper, employer - Trinity House, dates - 2018-present }
  { role - Inspector,     employer - Trinity House, dates - 2014-2018   }
]

@h1 @person.name h1@

@person.headline · @person.location

@h2 Experience h2@
(each @experience as job)
@h3 @job.role — @job.employer h3@

@job.dates
(end)
```

## API documentation entry

One endpoint or function, fully documented.

**Shape.** Name, signature, description, parameters as a table,
return value, example request.

**Load-bearing features.**
- `#params:` collection rendered via schema-array table.
- Wrapped `#code` for example requests.
- Cross-refs to other endpoints.

**Sketch.**

```
#endpoint: {
  method - GET
  path - /api/lighthouses/:id
  description - Retrieve a single lighthouse by id
}

#params: [
  { name - id,     in - path,  type - string,
    required - true,  description - Lighthouse id           }
  { name - expand, in - query, type - string,
    required - false, description - Comma-separated relations }
]

@h2 @endpoint.method @endpoint.path h2@

@endpoint.description

@h3 Parameters h3@
@table |schema name, in, type, required, description| |from @params|
table@

@h3 Example h3@
@code |lang shell|
curl https://api.example.com/lighthouses/dunmore?expand=keepers
code@
```

## Bug report / issue

A structured bug report.

**Shape.** Title and metadata, summary, expected vs actual,
reproduction steps, environment.

**Load-bearing features.**
- `#bug:` record with id, severity, reporter.
- Numbered reproduction steps via iteration.
- Environment as a record rendered as a table.

**Sketch.**

```
#bug: { id - 42, title - Lamp fails after fog, severity - high, reporter - Mara }

#repro: [
  Activate the foghorn at sea-level humidity above 95%.,
  Wait 30 minutes.,
  Observe the lamp dimming intermittently.
]

#env: {
  lamp_version - second-order
  lens_year - 1857
  last_service - 2025-11-14
}

@h1 #@bug.id — @bug.title h1@

*Severity*: @bug.severity · Reported by @bug.reporter

@h2 Reproduction h2@
@ol
(each @repro as step)
@li @step li@
(end)
ol@
```

## Lab notebook entry

A research / observation note: conditions, data, analysis, next steps.

**Shape.** Date and conditions, observations as a collection,
analysis prose, derived stats via script, next steps.

**Load-bearing features.**
- `#entry:` metadata record.
- `#measurements:` collection of records (one per observation).
- `<% %>` script for derived stats (peak, average).

**Sketch.**

```
#entry: { date - 2026-03-14, observer - Mara, weather - clear }

#measurements: [
  { time - 04:00, height - 2.1, notes - rising tide        }
  { time - 04:30, height - 2.3, notes - rising tide        }
  { time - 05:00, height - 2.4, notes - approaching high   }
]

@h1 Tide log — @entry.date h1@

Observer: @entry.observer · Weather: @entry.weather

@h2 Measurements h2@
@table |schema time, height, notes| |from @measurements|
table@

@h2 Analysis h2@

Rate of rise averaged 0.15m/hr through the observation window…
```

## When the genre doesn't fit

If your document doesn't match any genre above, fall back to the
underlying shapes:

- A handful of `#thing:` data defs at the top.
- Value-block defs for any named content blocks (citations, callouts,
  recurring snippets).
- Prose paragraphs with `@name` references where they belong.
- Optional `<% %>` script at the bottom for derived content.

Most documents are some combination of the above. See
[`quickstart.wit`](../examples/quickstart.wit) and
[`preferred.wit`](../examples/preferred.wit) for the baseline shapes.

## See also

- [`17-patterns-and-anti-patterns.md`](./17-patterns-and-anti-patterns.md) — checklist of what each genre shouldn't do.
- [`02-defs-and-captures.md`](./02-defs-and-captures.md), [`03-data-records-iteration.md`](./03-data-records-iteration.md) — the shapes every genre is built on.
- [`08-custom-nodes.md`](./08-custom-nodes.md) — wrappers for callouts, code, figures used across genres.
