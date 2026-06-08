# tests/fixtures — authoring conventions

These fixtures are the executable spec. Read this file before adding any.
Use `tests/fixtures/00-lexical/_notes.md` as the **format template** for
per-category notes.

## Layout

```
tests/fixtures/
  <NN>-<category>/
    <scenario>.wit       # one fixture = one purpose
    _notes.md            # category-level authoring notes
```

`NN` matches the M1.NN milestone (`00`–`17`).

## Filename rules

(a) **Kebab-case, scenario-descriptive.** Name what the file *tests*, not
    what it *contains*. Prefer `minimal-non-empty.wit` over `one-word.wit`,
    `multiple-trailing-newlines.wit` over `three-lf.wit`.

(b) **One fixture = one purpose.** If you reach for "and" in the filename,
    split the file. Combinations belong in `17-combinations/`.

## `_notes.md` rules

(c) **One per category.** Every H2 must cite a PLAN.md `I.x` open question
    — e.g. `## Paragraph boundaries (PLAN.md I.2)`. If a section raises a
    question not yet in PLAN, write `(no PLAN.md entry — new I.review item)`
    and surface it at the next review.

    `tests/fixtures/00-lexical/_notes.md` is the canonical template.
    M1.01+ briefings should point new contributors at it.

## Byte-sensitive fixtures

(d) When the file's *bytes* matter (CR/LF mixes, BOMs, trailing-NUL,
    UTF-8 edge cases), author via `printf` and verify with `od -c`. Record
    the `printf` invocation in the relevant `_notes.md` section so the
    fixture is reproducible. Do **not** edit these files in an editor that
    might silently normalize line endings.

(e) **`wc -l` undercounts files without a final LF.** A file ending in
    `foo` (no newline) reports `0` lines; `foo\n` reports `1`. If you see
    a fixture whose `wc -l` looks "off by one", check `od -c` before
    "fixing" it — the missing trailing LF may be the whole point of the
    test. Fixtures that intentionally lack a final LF should say so in
    `_notes.md`.

## Narration comments inside fixtures

Categories `00-lexical`, `01-prose`, `02-emphasis`:
narration comments (`~ ...`) inside the `.wit` file are **fine** — at this
stage the comment marker itself is barely under test.

From `03-comments/` onward:
**narration must move to `_notes.md`.** The comments that remain inside the
fixture are exactly what is being tested. A fixture in `03-comments/` that
contains a `~ smallest non-empty input` line is testing that line, not
explaining itself.

## Workflow

1. Add or modify fixtures.
2. Update the category `_notes.md` (cite `I.x` or flag a new `I.review`).
3. Run `pnpm test`. Snapshots will be missing on first run — review the
   diff and `pnpm test --update` once intentional.
4. Commit fixture + notes + snapshot together.
