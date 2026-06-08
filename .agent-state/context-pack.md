# context-pack — active orchestration artifact (RULES.md rule 6)

The implementer's only mandatory read. Decisions and history live in git
(commit messages, `_notes.md` files merged to main). The implementer
codes blind to prior decisions and writes for the current task's local
scope. Downstream-conflict checking happens at the **reviewer** stage,
not here.

## 1. How to use this pack

You are an implementer for one Wit fixture-authoring task. Read this
pack. Skim the current task brief (section 4). Author the fixtures
and `_notes.md` for the local category. Self-review against section 3.
Commit on a fresh branch. Return ≤ 20 lines per section 5. Don't read
PLAN.md or prior `_notes.md` unless you need a specific spec citation
for your own notes — and even then, just that one line.

## 2. Conventions

- Files stay under 350 lines; functions stay at 20 lines (RULES 1, 2).
- Fixture filenames are kebab-case and scenario-descriptive (name what
  the file *tests*, not what it contains).
- One `.wit` file = one purpose. If you reach for "and" in the filename,
  split into two fixtures. Combinations live in `17-combinations/`.
- Narration `~ ...` inside `.wit` is **forbidden from `03-comments/`
  onward**. Every byte in those fixtures is test input. All explanatory
  text goes in `_notes.md`.
- Each `_notes.md` H2 must cite `PLAN.md I.x` OR mark
  `(no PLAN.md entry — new I.review item)`. Bare `DS-x` / `W.x` tags do
  NOT belong in H2 headings — keep them in body cross-refs.
- Each H2 raising an open question includes a `**Concrete proposal:**`
  line committing to rule (a) / (b) / (c) with rationale. It's a lean
  for review, not a final decision.
- For byte-sensitive fixtures (CRLF, bare CR, BOM, no-trailing-LF):
  author via `printf`, verify with `od -c`, record the invocation in
  `_notes.md`. Don't "fix" intentional no-trailing-LF cases.
- Snapshot files do not yet exist; the parser is not yet built. M1
  fixtures are bytes-only — `pnpm test` should exit clean (no
  `.test.ts` added by fixture tasks).

## 3. Self-review checklist (run before committing)

- [ ] If category ≥ 03: `grep -rE "^~ " <category>/*.wit` returns nothing.
- [ ] All filenames kebab-case, no "and" in any filename.
- [ ] Every `_notes.md` H2 matches `(PLAN.md I.x)` OR
      `(no PLAN.md entry — new I.review item)`.
- [ ] Each open-question H2 has a `**Concrete proposal:**` line.
- [ ] No tokens used that aren't part of this category's surface (the
      task brief in section 4 enumerates what's in-scope).
- [ ] `_notes.md` under 600 lines; each fixture under 30 lines.
- [ ] `pnpm test` exits 0 (no test files added).

## 4. Current task brief

Edited per-task by the main session. The implementer reads only this
block, not the locked-decisions or downstream-horizon material that
used to live here.

```
TASK: <e.g. M1.11 — data-access fixtures>
CATEGORY DIR: tests/fixtures/<NN>-<name>/
BRANCH: m1-<NN>-<name>-fixtures
COMMIT: M1.<NN>: <one-line description>

SCOPE: <one-paragraph scope statement>

FIXTURES (one purpose each, kebab-case):
- <filename>.wit — <one-line purpose>
- ...

EXPECTED _notes.md H2 SECTIONS (cite I.x or "no PLAN entry — new
I.review item"; each open-question H2 includes a concrete proposal):
- <section> — <open question this surfaces>
- ...

OUT OF SCOPE FOR THIS CATEGORY (don't introduce these tokens unless
the fixture's purpose explicitly requires them):
- <list>
```

## 5. Return format contract

Implementer returns exactly this block, ≤ 20 lines:

```
Branch: <name>
SHA: <first 7>
Summary: <one line>
New I.review items: <bullet list, or "none">
Self-review: <pass | needs review of X>
Deviations from briefing: <bullet list, or "none">
```

NO fixture content. NO `_notes.md` dumps. NO full diffs. The reviewer
agent (run periodically by the main session) reads the actual diffs
from git.

## Notes for the main session

- Update section 4 (current task brief) before each implementer
  dispatch. Small Edit, ~30 seconds.
- Decisions are NOT tracked here. They live in:
  - `git log --oneline main` (commit history)
  - `tests/fixtures/<NN>-*/_notes.md` (per-category notes on main)
- Downstream-conflict checks happen at the reviewer stage. The
  reviewer agent (every 3–4 merged tasks) reads:
  - the batch of diffs since last review
  - the next 3–5 tasks from `TaskList` / PLAN
  - flags any conflicts or convention drift
- If this file drifts past 200 lines, compact section 4 or trim
  redundant convention bullets.
