# 02-emphasis fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the two inline marks only — `_italic_` and `*bold*`. Spec page 3:
"These are the only inline marks in the base language, and because they
wrap a token rather than living at the start of a line, ordinary
punctuation in your prose can never trigger them by accident." Comments
beyond a single narration line, nodes (`@`), defs (`#`), parameters,
records, and short-close (`!!`) all live in later categories and are
absent from every fixture below.

## Baseline italic and bold (PLAN.md DS-2 / 2.U.1, 2.U.2)

- `basic-italic.wit` and `basic-bold.wit` are the minimum-viable probes
  for `_word_` and `*word*` respectively. One word, one mark, one
  paragraph. Cross-cuts: any change to the tokenizer that breaks these
  breaks the language; treat as a canary pair.
- Both fixtures place the mark mid-paragraph, flanked by single spaces
  on both sides. The opener is preceded by a non-word character (space)
  and the closer is followed by a non-word character (space or period).
  The intended rule (PLAN §2.U.1/2.U.2) is "wraps a token"; these
  fixtures pin the simplest token shape — a single alphabetic word.

## Combined marks — both orderings (PLAN.md I.review; cross-refs 2.C.3)

- `combined-bold-italic.wit` includes BOTH `_*word*_` (bold inside
  italic) and `*_word_*` (italic inside bold). PLAN §2.C.3 promises
  "Nested marks ... resolve cleanly" but does not commit to a precedence
  rule. Surfacing here: do both orderings yield the same tree shape with
  swapped outer/inner kinds, or is one ordering canonical and the other
  normalized? Lean: symmetric, no precedence.
- Open (no PLAN.md entry — new I.review item): three or more mark
  characters adjacent (`*__x__*`, `_**x**_`, `***x***`) are not probed
  here. Two-character runs already raise the empty-mark question (see
  below); deeper combinations should wait for a tokenizer decision on
  the empty-mark case before fixtures are written.

## Apostrophe boundary (PLAN.md DS-2 / 2.U.3)

- `apostrophe-after-italic.wit` is the canonical probe for 2.U.3
  ("`_word_'s` recognizes mark + apostrophe-s"). The italic closes on
  the second underscore; the `'s` is plain text on the outside.
- Open (no PLAN.md entry — new I.review item): does the lexer
  substitute smart quotes (`'` -> `'`) anywhere? 01-prose surfaced this
  for `"..."` and `'...'` pairs; here it matters specifically for the
  apostrophe-after-mark case, because a smart-quote substitution at the
  italic boundary changes the byte that follows the closer and could
  affect the boundary rule. Lean verbatim; spec is silent.

## Arithmetic shapes — digit-flanked asterisks (PLAN.md DS-2 / 2.U.4)

- `arithmetic-shapes.wit` is the emphasis-side assertion of the same
  `5*6*7` shape probed in `01-prose/numbers-and-arithmetic-shapes.wit`.
  PLAN §2.U.4 promises bold tokenization rejects this. The intended
  rule: a `*` flanked by digits on both sides is not an opener and not
  a closer.
- Cross-category fragility: the 01-prose snapshot for the same run is
  observable to this category; if 2.U.4 lands and changes the prose-side
  AST shape, both fixture snapshots must be revalidated together. Noted
  also in `01-prose/_notes.md` under "Punctuation, quotes, numerics".
- Open (no PLAN.md entry — new I.review item): the boundary rule for
  `*` is informally "non-word character on the outside of the opener,
  non-word character on the outside of the closer." Digits count as
  word characters; spaces and punctuation do not. The fixture pins the
  digit case; a digit-then-letter case (`5*x*7`, `x*5*y`) is not yet
  probed and may need its own fixture once the rule is committed.

## Intra-word underscore (PLAN.md DS-2 / 2.U.5, W2.5)

- `underscore-in-identifier.wit` pins `snake_case_word`: an underscore
  flanked by letters on both sides must not open italic. Spec page 3
  ("wrap a token rather than living at the start of a line") and
  PLAN §W2.5 ("`_` in identifiers in prose without triggering italic")
  both endorse this; the fixture is the executable form.
- Same rule shape as the arithmetic-shapes case for `*`, but the
  flanking characters are letters rather than digits. Symmetric pair
  with `arithmetic-shapes.wit` — together they pin "intra-word mark
  character does not trigger emphasis" for both marks.

## Empty marks (PLAN.md DS-2 / 2.U.5; new I.review item for legality)

- `empty-marks.wit` contains `__` and `**` as standalone tokens. PLAN
  §2.U.5 promises "`__`, `**` are not emphasis" but does not say what
  they ARE. Three candidate behaviors:
  (a) literal — `__` and `**` are plain text, two underscores / two
      asterisks in the run;
  (b) error — emit `E_EMPTY_EMPHASIS` (or similar) with loc;
  (c) empty emphasis node — `Italic { content: [] }`, `Bold { content: [] }`.
  Lean (a). M1.review will pick. The fixture commits the bytes, not the
  AST.
- Cross-cuts with `markdown-ish-leaders.wit` in 01-prose (the `*`
  leader case). That fixture pins `*` followed by whitespace at column
  0 as prose; this fixture pins `**` followed by whitespace mid-prose
  as ??? — both feed the same word-boundary rule for `*`.

## Word-boundary rules for `_` and `*` (no PLAN.md entry — new I.review item)

- Three fixtures (`apostrophe-after-italic.wit`,
  `arithmetic-shapes.wit`, `underscore-in-identifier.wit`) together
  triangulate the word-boundary rule that PLAN does not yet spell out.
  The candidate rule:
  - **Opener:** mark character preceded by a non-word character (or
    start of paragraph) and followed by a word character.
  - **Closer:** mark character preceded by a word character and
    followed by a non-word character (or end of paragraph).
  - **Word character:** `[A-Za-z0-9]` (lean) — note this means an
    underscore between two letters is NOT a word boundary on either
    side, which gives `snake_case_word` the desired plain-text outcome.
- New I.review item: commit the word-character definition. Unicode
  letters (accented characters, CJK) are not probed by any 02-emphasis
  fixture and should be either explicitly in or explicitly out of the
  word-character class.

## Marks at paragraph boundary (PLAN.md DS-2 / 2.C.2)

- `marks-at-paragraph-boundary.wit` places `_Alone_` as the first
  token of paragraph 1, `*dawn*` as the last token of paragraph 2, and
  `*Morning*` as the first token of paragraph 3. PLAN §2.C.2 promises
  "Mark cannot span blank line — closes implicitly or errors." This
  fixture does not probe an unclosed mark; it probes the easier
  positive case (mark fully contained within one paragraph, but flush
  to a paragraph boundary on one side).
- The intended rule: start-of-paragraph counts as a non-word character
  for opener qualification; end-of-paragraph counts as a non-word
  character for closer qualification. Spec page 3 says marks "wrap a
  token rather than living at the start of a line" — the fixture pins
  that an opener AT the start of a line is still legal as long as it
  wraps a token (i.e. is followed by a word character, then a closer,
  then whitespace).
- Deferred: an unclosed mark that runs to the blank line
  (`_word\n\nrest`) is the negative form of 2.C.2 and belongs in the
  errors directory once the error code is named.

## Narration comments (PLAN.md I.1)

- Per `tests/fixtures/README.md`, narration `~ ...` inside `.wit`
  files is still permitted in 02-emphasis. Every fixture here opens
  with one or two narration lines flushed against the first prose
  line (no blank between). 03-comments locks this convention out;
  reviewers should not propagate it further.
- Open (carrying over from 00-lexical and 01-prose `_notes.md`): even
  when the comment marker IS in column 0, are comment lines AST nodes
  or elided? Not probed here.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing LF. No
  CR/LF or BOM variants of emphasis-specific cases are authored — the
  byte-level probes already live in 00-lexical. If an emphasis-specific
  byte-edge case (a mark character split across a CRLF, say) appears at
  review, add it then.
