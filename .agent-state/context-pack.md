# context-pack — active orchestration artifact (RULES.md rule 6)

Living briefing for the next Wit fixture-authoring task. Maintained by the
main session; the implementer reads only this file plus, when needed, a
specific PLAN.md / spec citation for its own `_notes.md`.

## 1. How to use this pack

You are an implementer for a Wit fixture-authoring task. This pack is your
**only** mandatory read. Reference `PLAN.md` / prior `_notes.md` only when
you need a specific spec citation for your own `_notes.md`. Self-review
against the checklist (section 6) before committing. Commit on a fresh
branch; main session merges. Return ≤ 20 lines per the contract in
section 7. No fixture content, no `_notes.md` dumps, no full diffs in
the return.

## 2. Conventions

- Files stay under 350 lines; functions stay at 20 lines (RULES 1, 2).
- Fixture filenames are kebab-case and scenario-descriptive (name what
  the file *tests*, not what it contains).
- One `.wit` file = one purpose. If you reach for "and" in the filename,
  split into two fixtures. Combinations live in `17-combinations/`.
- Narration `~ ...` lines inside `.wit` files: **forbidden from
  `03-comments/` onward**. Every byte in those fixtures is test input.
  All explanatory text goes in `_notes.md`.
- Each `_notes.md` H2 must cite `PLAN.md I.x` (e.g. `(PLAN.md I.6)`) OR
  mark `(no PLAN.md entry — new I.review item)`. Bare `DS-x` / `W.x` /
  `T.x` tags do **not** belong in H2 headings — keep them in body
  cross-refs.
- Each H2 that raises an open question must include a
  `**Concrete proposal:**` line committing to rule (a) / (b) / (c) with
  rationale. The proposal is a lean, not a final decision; M1.review
  resolves.
- Narration lines (where still permitted, ≤ 02-emphasis) flush against
  the first prose line — no blank line between narration and content.
- For byte-sensitive fixtures (CRLF, bare CR, BOM, no-trailing-LF):
  author via `printf`, verify with `od -c`, and record the exact
  invocation in the relevant `_notes.md` section so the fixture is
  reproducible.
- `wc -l` undercounts files without a final LF. Intentional
  no-trailing-LF cases must state so in `_notes.md`; don't "fix" them.
- Snapshot files do not yet exist; the parser is not yet built. M1
  fixtures are authored bytes-only — `pnpm test` should still exit
  clean (no `.test.ts` files are added by fixture-authoring tasks).
- Cross-file fixtures (e.g. `cross-file-merge/`) use relative
  `reference ./x.wit` paths to match `examples/` style. Path resolution
  semantics (DS-8) are not under test until M1.14.

## 3. Locked decisions (committed proposals from prior tasks)

Distilled from M1.00–M1.09 `_notes.md`. These are concrete proposals —
not final spec — but no current-task should override them silently.

Typography / whitespace:
- I.2 paragraph boundary: single LF collapses to space (soft-break
  lean); two-or-more LFs separate paragraphs.
- I.15 record indentation: cosmetic. Braces are the structural
  boundary; whitespace inside is reader-only.

Comments / tildes:
- I.1 comment AST: retained as AST nodes with `loc`, elided at render.
  Lean distinct `LineComment` / `BlockComment` kinds.
- I.1 triggers: `~ ` (tilde + whitespace) at column 0 opens line
  comment; `~~` anywhere opens block; `~~/` closes block; internal
  `~~` inside open block is content.
- I.1 prose discriminator: `~5`, `~/path`, `x ~ y` are prose.

Emphasis (DS-2):
- Word-boundary class: `[A-Za-z0-9]`. Opener = non-word/mark/word;
  closer = word/mark/non-word.
- Empty marks (`__`, `**`): lean (a) literal text. Uncommitted.

Nodes (M1.04):
- I.6 bare reference boundary: rule (b). Handle class `[A-Za-z0-9_-]`.
  Dot opens access-path segment; any other byte terminates the handle.
  Sentence-final period disambiguated by one-byte lookahead after dot.
- 4.S.2 inline-vs-block classifier: standalone-line → block;
  inside paragraph → inline. Applies to parens-form too.
- Closer pairing: stack-based LIFO for nested same-name.
- Empty body (`@x x@`): body is `[]`, not null.

Parens-form parameters (M1.05):
- I.12 multi-word flag: rule (a) whole-slot. `@badge(full width!)` →
  `Flag(name="full width")`.
- Trailing comma: rule (a) tolerated, no empty slot.
- Inner whitespace: rule (a) strip leading/trailing per slot.
- Hyphen separator: ` - ` (space-hyphen-space) splits key/value;
  literal hyphens stay identifier bytes. Same rule in parens & pipes.
- Empty parens `@x()`: lean (b) legal, distinct from bare `@x`.
  `Param[]=[]`, `ParamSource='parens'`.
- I.11 mix parens + pipes: lean parse error — mutually exclusive.
- I.17 parens + `!!`: lean not allowed — parens already self-closed.
- Parens-then-body (`@x(p) body x@`): lean error.

Pipe-form parameters (M1.06):
- 5.U.7 empty `||` in body: rule (a) error. `||` reserved for
  capture-list openers in definitions.
- 5.U.3/5.U.4 bare-positional vs flag: positional unless trailing `!`.
- 5.C.1/5.C.3 last-one-wins: parser collects all (regardless of
  position); resolver collapses per key. Two passes. Loc on survivor
  points at surviving bytes.
- Pipe-shaped text in body: rule (a) position-sensitive slot
  recognition — mid-paragraph `|...|` is literal Text.
- 5.U.1/5.U.2 key/value split: first ` - ` if present; else first
  space. Literal hyphens stay identifier bytes.

Definitions (M1.07):
- I.7 `!!`: rule (a) context-only — only inside an open `#name:` /
  `#name:\n` value. Elsewhere literal.
- I.16 body slot `...`: rule (a) at-most-once, anywhere in block-shape
  body. Multiple is error. In single-line / value-block values,
  `...` is ellipsis text.
- I.8 forward references: rule (c) resolved-at-expand-time. Surface
  behavior is full hoisting.
- I.9 definition scope: rule (b) global within reference graph.
- 6.S.4 shape classification: rule (a) decided at opener byte.
  `#name\n` → block; `#name: v !!` → single-line; `#name:\n` →
  value-block.
- `::name::` interpolation: rule (a) context-only — only inside a
  definition body. Same machinery as I.7.
- `||a, b, c||` capture list: legal **only** in definition opener
  position; elsewhere body-context `||` rules from M1.06 apply.

Additive partials (M1.08):
- DS-7 merge: rule (a) expand-time merge. Parser emits per-file
  `additive:true` contributions; resolver concatenates across the
  reference graph.
- Mix `#x` + `+#x`: rule (a) base + additives compose. Base is
  contribution-zero; additives follow in document order.
- Shape compatibility: rule (a) shapes must match across
  contributions; block + single-line is error (no coercion).
- Order: rule (a) depth-first reference traversal; within a file,
  byte-offset order.
- Cross-file scope: rule (a) shared namespace across reference graph.
- Captures on `+#x`: rule (b) forbidden — additives extend body only.
  `additive-with-captures.wit` is an ERROR fixture.
- Lone `+#x` (no base, no sibling): rule (a) legal.

Records (M1.09):
- I.5 scalar typing: rule (a) eager. Signed decimal int / float →
  Number; lowercase `true` / `false` → Bool; else String. No sci
  notation, no hex, no underscores, no `Infinity`.
- I.4 comma in record value: rule (a) comma always terminates field
  at brace level. `{ msg - hello, world }` is an ERROR fixture.
- Nested record value shape: rule (a) brace value implies no `-`
  separator. `{ a { b - 1 } }` → field `a` with nested-record value.
- Trailing comma: rule (a) tolerated, no empty field. Parity w/ parens.
- Empty record `{ }`: rule (a) legal, `fields: []`.
- Boolean recognition: rule (a) lowercase exact only.
- Record-in-param: rule (a) legal, deferred to combinations / review.

## 4. Open questions with concrete-proposal leans

Each open `I.x` and each new-`I.review` item raised across the prior
ten `_notes.md` files. Implementer must respect the leans; surfacing
counterexamples is welcome.

Typography / whitespace:
- I.2 (whitespace-only line as paragraph boundary): lean **yes**
  count as blank. Source: 00-lexical.
- I.2 (CR / CRLF normalization stage): lean pre-lex normalize to LF.
  Source: 00-lexical.
- I.2 (trailing `\n\n\n`): lean zero trailing empty paragraphs.
  Source: 00-lexical.
- I.15 (mixed inline + multi-line record body): lean legal, commas
  and newlines are both field separators. Source: 09-records.
- Tabs vs spaces in prose leading whitespace: lean stripped, but
  uncommitted. Source: 00-lexical `tabs-vs-spaces.wit`.

Comments / tildes:
- Comment carries trivia (leading/trailing whitespace) on itself,
  neighbour, or neither: lean on itself. Source: 03-comments.
- Comment line between two prose lines (no blank): lean joiner — one
  paragraph with comment node retained inside it. Composes with
  I.2 single-newline collapse. Source: 03-comments.
- Block comment crossing blank line: lean legal. Source: 03-comments.
- `~~~/` inside block (three tildes then slash): lean leftmost-longest;
  first two tildes plus slash form closer. Source: 03-comments.
- Empty comment `~~ ~~/`: lean (a) legal, empty `Comment`. Source:
  03-comments.

Emphasis:
- Three-or-more adjacent mark chars (`***x***`, `_**x**_`): not
  probed; defer until empty-mark decision lands. Source: 02-emphasis.
- Smart-quote substitution at mark boundary: lean verbatim. Source:
  02-emphasis / 01-prose.
- Unicode word-character class: not committed; ASCII-only lean.
  Source: 02-emphasis.
- Markdown-ish leaders (`>`, `*`, `-`, `1.`): lean (a) literal — the
  leader char stays in `Text`. Source: 01-prose.

Nodes / handles:
- Handle character class extended to Unicode: three options listed
  (ASCII-only, NFC Unicode, UAX #31). Lean ASCII-only. Source:
  04-nodes-use.
- Handle starting with underscore (`@_private`): lean no. Source:
  04-nodes-use.
- Handle case sensitivity: lean yes (exact match). Source:
  04-nodes-use.
- Trailing hyphen in handle (`@paper-` with no continuation): lean
  handle must end on letter/digit/underscore. Source: 04-nodes-use.

Parameters:
- I.4 (value quoting): defer; no commitment. Three options listed
  (no escape, backslash, quoted string). Source: 05/06/09.
- Mid-value `!` in slot (`|caption Wow! lens|`): lean punctuation
  only, only final `!` before delimiter is the flag marker. Source:
  06-parameters-pipes.
- Pipe slot containing literal `|`: lean rephrase / escape (depends
  on I.4 resolution). Source: 06-parameters-pipes.
- Positional last-one-wins (two `|lamp.png|` slots): lean appended,
  no dedup. Source: 06-parameters-pipes.
- Whitespace-only slot `| |`: lean error (trims to empty). Source:
  06-parameters-pipes.
- Mid-body scatter loc on surviving Named: lean third occurrence.
  Source: 06-parameters-pipes.

Definitions:
- Nested definitions (`#outer ... #inner ... inner# ... outer#`):
  lean innermost-wins (LIFO). Source: 07-definitions.
- Empty single-line value `#name: !!`: lean legal, empty string.
  Source: 07-definitions.
- Definition redefinition (two `#x:`): lean error unless `+#x`.
  Source: 07-definitions (resolved by M1.08 base + additives rule).
- Empty capture list `#x ||||`: lean equivalent to no capture list.
  Source: 07-definitions.
- Capture name character class: lean parity with handle class
  `[A-Za-z0-9_-]`. Source: 07-definitions.

Additive partials:
- I.14 (loc on merged parent NodeDef): lean first contribution's
  loc. Child nodes carry per-contribution loc. Source: 08-additive.
- Reference de-duplication (same `reference ./x.wit` twice): lean
  load once, contribute once. DS-8 territory. Source: 08-additive.
- Whitespace between `+` and `#` (`+ #name`): lean error. Source:
  08-additive.

Data / records:
- I.5 number recognition extras (sci notation, hex, `Infinity`):
  lean String. Source: 09-records.
- Empty record value `{ a - }`: lean error. Source: 09-records.
- Duplicate keys in record (`{ a - 1, a - 2 }`): not committed —
  last-wins vs error tension. Source: 09-records.
- Reserved-word keys (`{ if - 1, each - 2 }`): lean legal as keys.
  Source: 09-records.
- Records inside collections: belongs to M1.10. Source: 09-records.

Cross-cuts:
- I.3 access-path legal positions: lean lex-anywhere; resolver
  decides renderability. Source: 04-nodes-use.
- I.7 / I.16 / I.17 interaction: lean `!!` is definition-only.
- DS-15: error fixtures live in `tests/errors/`, not happy-path
  categories. Several "ERROR fixture" entries above (comma-in-value,
  additive-with-captures, mixed-body-shape, parens-then-body) re-role
  once DS-15 codes are enumerated.

## 5. Downstream horizon

Next 3–5 tasks. Each lists scope, syntax introduced, tokens the
current task should AVOID, and cross-cuts with locked decisions.

M1.10 collections (`10-collections/`) — **immediate next**:
- Scope: collection literals `[ ... ]` (DS-9). Sibling to records;
  same scalar / multi-word value rules; same trailing-comma and
  empty-container rules.
- Syntax introduced: `[`, `]`, comma-separated items, multi-line
  bracket bodies, nested collections, collections of records.
- Tokens to AVOID in upstream categories: `[` and `]` should not
  appear with structural meaning in `00–09` fixtures.
- Cross-cuts: ratifies record proposals (I.5 eager scalar, I.4 comma
  always terminates field, trailing-comma tolerance, empty-container
  legality). Records-inside-collections lands here (9.C.2 row).

M1.11 data access (`11-data-access/`):
- Scope: `@x.y`, `@x.0`, `@x.y.0.z`, fuzzy key matching (DS-10).
- Syntax introduced: dot access segments; numeric indices.
- Tokens to AVOID in 10-collections: `@x.y` access paths beyond
  bare handles inside container values. Lean: legal but defer the
  probe to 11.
- Cross-cuts: I.6 handle boundary (dot is the only non-class byte
  that does NOT end the handle), 04-nodes-use access-path lean.

M1.12 conditionals (`12-conditionals/`):
- Scope: `(if … end)`, `(if … else … end)`, `is` / `equals` / truthy
  (DS-11).
- Syntax introduced: parenthesised statements `(if ...)`, keywords
  `if`, `else`, `end`, `is`, `equals`.
- Tokens to AVOID: `(if`, `(each`, `is`, `equals`, `else`, `end` as
  prose in 10 / 11. They currently have no special meaning in
  earlier categories but should not be planted in fixtures.
- Cross-cuts: DS-11 truthy form uses bare `@x.y` references — the
  I.3 access-path-legal-positions lean applies inside conditions.

M1.13 iteration (`13-iteration/`):
- Scope: `(each @x as item)`, nested each, each + if (DS-12).
- Syntax introduced: keyword `each`, `as`, loop-variable binding.
- Tokens to AVOID: `each`, `as` as prose in 10 / 11 / 12.
- Cross-cuts: requires the M1.10 collection grammar to be settled
  (each iterates over a collection); requires the M1.11 access
  grammar (loop body accesses item fields).

M1.14 composition / references (`14-composition/`):
- Scope: `reference ./path.wit`, relative path resolution, circular
  detection (DS-8).
- Syntax introduced: `reference` keyword + path string.
- Tokens to AVOID: `reference` as a bare prose word in earlier
  categories where it sits at column 0 (it currently does not).
- Cross-cuts: DS-7 cross-file merge from M1.08 used relative
  references already; M1.14 makes the resolution rule canonical.

## 6. Self-review checklist

Before committing, the implementer runs each check:

- [ ] `grep -rE "^~ " <category>/*.wit` returns nothing for any
      category numbered `03` or higher.
- [ ] All fixture filenames are kebab-case and scenario-descriptive.
- [ ] No "and" in filenames (split if you reach for it).
- [ ] Every H2 in `_notes.md` matches `(PLAN.md I.x)` OR
      `(no PLAN.md entry — new I.review item)`. No bare `DS-x` /
      `W.x` tags in H2 (those go in body cross-refs).
- [ ] Each open-question H2 has a `**Concrete proposal:**` line
      committing to (a) / (b) / (c) with rationale.
- [ ] No forbidden tokens for this category (see section 5
      Downstream horizon for tokens reserved by future categories).
- [ ] File lengths plausible (3–30 lines for fixtures, < 600 for
      `_notes.md`).
- [ ] `pnpm test` exits clean (no `.test.ts` files added by this
      task; M1 is fixture-authoring only).
- [ ] No fixture imports across categories — each `.wit` is
      self-contained except where the category explicitly probes
      cross-file (e.g. `cross-file-merge/`).

## 7. Return format contract

The implementer's return must be ≤ 20 lines:

```
Branch: <name>
SHA: <first 7>
Summary: <one line>
New I.review items: <bullet list, or "none">
Self-review: <pass | needs review of X>
Deviations from briefing: <bullet list, or "none">
```

NO `_notes.md` content. NO fixture content. NO full diffs. Main
session reads the diff directly when needed.
