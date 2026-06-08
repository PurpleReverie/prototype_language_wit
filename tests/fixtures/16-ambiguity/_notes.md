# 16-ambiguity — cross-cut probes

This category authors no new syntax. Each fixture takes a rule declared
in an earlier category and stresses it under natural-prose conditions
to confirm the rule does not accidentally fire (or fail) in the wild.
Most H2s below AFFIRM prior leans.

## tilde-home-path.wit (PLAN.md I.3)

Cross-cut probe of the line-comment rule from `03-comments/`. A bare
`~/` mid-prose — as in `~/Documents` — must not be mistaken for a
line-comment opener. The line-comment lean requires `~ ` (tilde +
ASCII space) at the start of a line; `~/` fails both the leading-
position and trailing-space conditions.

**Concrete proposal:** rule (a) — line comments require leading-of-line
`~` followed by U+0020. Anywhere else, `~` is a literal text byte. This
fixture AFFIRMS that lean; no change requested.

## mid-line-arithmetic.wit (PLAN.md I.2)

Cross-cut probe of the emphasis rule from `02-emphasis/`. The `*`
emphasis delimiter (per 02's lean) requires word-boundary flanking:
opener has non-word before / word after, closer mirrors. `5*6*7` has
digits on both sides of every `*`, so none can open or close.

**Concrete proposal:** rule (a) — `*` emphasis remains flanking-sensitive
exactly as 02-emphasis declared. Digit-flanked `*` is arithmetic prose.
This fixture AFFIRMS the lean.

## year-period-space.wit (PLAN.md I.1)

Cross-cut probe of paragraph / list parsing from `01-prose/`. A period
followed by a space mid-paragraph (`1970. It`) must not start a new
block or be confused with an ordered-list marker. The list lean
requires a digit-run followed by `. ` at line start — not mid-line.

**Concrete proposal:** rule (a) — ordered-list markers only fire at the
start of a line. Sentence-internal `digit. ` stays prose. This fixture
AFFIRMS the lean.

## blockquote-leader.wit (PLAN.md I.1)

Cross-cut probe of `01-prose/`. Wit (per current leans) does not
reserve `>` as a blockquote leader. A line beginning with `> ` must
render as ordinary prose.

**Concrete proposal:** rule (a) — `>` is never a block marker in Wit.
This fixture AFFIRMS the lean. (If a future category wants blockquote
semantics it should be a new I.review item, not a retroactive change.)

## apostrophe-after-italic.wit (PLAN.md I.2)

Cross-cut probe of `02-emphasis/` boundary handling. The pattern
`_word_'s` should close italic at `_` and then continue with `'s` in
prose. This multi-case probe adds `_book_'s`, `_author_'s`, and a
multi-word `_multi-word phrase_'s` to stress the closing-flank rule
against trailing apostrophe-s possessives.

**Concrete proposal:** rule (a) — `_` closing requires word-before /
non-word-after; apostrophe counts as non-word, so closure succeeds and
`'s` trails as prose. This fixture AFFIRMS the lean.

## em-dash-vs-hyphen.wit (PLAN.md I.6)

Cross-cut probe of `06-parameters-pipes/`. The parameter separator
lean uses ASCII ` - ` (space-hyphen-space). Em-dash ` — ` (U+2014)
must NOT be confused with that separator and must stay prose.

**Concrete proposal:** rule (a) — parameter separator is the exact
byte sequence ` - ` (U+0020 U+002D U+0020). Any other dash glyph is
prose. This fixture AFFIRMS the lean and explicitly rejects em-dash
as a separator alternative.

## multi-blank-line.wit (PLAN.md I.1)

Cross-cut probe of `01-prose/` paragraph-break semantics. Three or
more consecutive blank lines must collapse to a SINGLE paragraph
break, not multiple. Authored with `printf` so byte boundaries are
explicit; verified with `od -c`: two LFs after `paragraph.` then two
more blank lines (`\n\n\n\n` = three blank lines between blocks),
then `\n\n\n\n\n` = four blank lines before the third block.

**Concrete proposal:** rule (a) — any run of ≥ 1 blank line is one
paragraph break. Trailing blank lines before EOF do not produce
additional blocks. This fixture AFFIRMS the lean.

Invocation: `printf 'First paragraph.\n\n\n\nSecond paragraph after
three blank lines.\n\n\n\n\nThird paragraph after four blank
lines.\n' > multi-blank-line.wit`.

## deep-nesting.wit (PLAN.md I.4)

Cross-cut probe of `04-nodes-use/`. Stacks 7 `@x` openers and 7 `x@`
closers to confirm the symmetric-balance rule has no shallow depth
limit at the lexical layer. A second 5-deep line provides a
distinct-name variant.

**Concrete proposal:** rule (a) — NodeUse balance is purely
positional; no fixed depth cap. Any depth limit lives in the parser
budget, not the lexer. This fixture AFFIRMS the lean; flags
**(no PLAN.md entry — new I.review item)** if a depth budget is later
wanted at lex time.

## path-collision-comment.wit (PLAN.md I.3)

Cross-cut probe of `03-comments/`. Inline `~~ ... ~~` comment spans
must tolerate `~/` paths inside their body without prematurely
closing or re-opening. The `~/Documents`, `~/.config/wit.toml`, and
`~/bin/run-script` interiors all contain `~` followed by non-space,
which is not a comment delimiter.

**Concrete proposal:** rule (a) — inline comments close only on
`~~` (two tildes), never on a lone `~`. Path tildes are inert
inside comment bodies. This fixture AFFIRMS the lean. (Note: this
class is restated here from 03-comments under the path-collision
heading; the original fixture stays where it is.)

## email-in-prose.wit (PLAN.md I.4)

Cross-cut probe of `04-nodes-use/` boundary rule. `@` opens a
NodeUse only when preceded by a non-word byte (start of line, space,
punctuation). Email addresses like `keeper@example.org` have a
letter immediately before `@`, so the NodeUse opener does not fire.

**Concrete proposal:** rule (a) — `@` requires non-word-before to
open a NodeUse. Letter-before-`@` is always prose. This fixture
AFFIRMS the M1.04 boundary lean. A reviewer might want to also
verify digit-before-`@` (e.g. `agent007@example.com`) — flag as a
follow-up probe **(no PLAN.md entry — new I.review item)** if not
already covered.

## Cross-cutting summary

All ten probes AFFIRM prior leans. No prior rule was revealed wrong
by these fixtures. One follow-up flagged: digit-before-`@` variant
for the NodeUse boundary rule (I.review).
