# 00-lexical fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

## Paragraph boundaries (PLAN.md I.2)

- `multi-paragraph.wit` assumes a single blank line separates paragraphs.
  Spec confirms ("a blank line is a paragraph"). Unresolved: what is a
  "blank line"?
  - Purely empty (`\n\n`)?
  - Or any line whose content is only whitespace (`   \t  \n`)?
  `whitespace-only-line.wit` deliberately probes this — the answer
  changes the paragraph count from 1 to 2.
- I.2 itself: a *single* newline within a paragraph — collapse to space
  or preserve as a soft break? None of these fixtures contains a
  multi-line paragraph yet (deliberately deferred to 01-prose fixtures),
  but the question already bites `mixed-newlines.wit`: if the parser
  normalizes CR/CRLF/LF to LF *before* paragraph-splitting, the file is
  four lines with no blank lines, i.e. one paragraph with three soft
  line breaks. If normalization happens *after* splitting, the result
  differs. Order of operations matters.

## Comments (PLAN.md I.1)

- All fixtures use `~ ...` as the comment marker because that is what
  `examples/01-prose.wit` and `examples/03-comments.wit` use. The
  rendered `wit-spec.pdf` (pp. 3–4) shows `\- ... -\` instead. Treating
  the examples as the source of truth here; flagging the divergence.
- I.1: are these `~ ...` lines AST nodes or fully elided? The fixture
  text is agnostic — every comment is on its own line, so removing them
  changes line count but not paragraph structure (assuming the comment
  line itself does not act as a blank-line separator). Worth deciding
  before snapshots exist: does a comment line between two prose lines
  *join* them into one paragraph or *separate* them into two?

## Newline conventions (PLAN.md I.2)

- `windows-newlines.wit`, `mac-newlines.wit`, `mixed-newlines.wit`
  were written via `printf` to guarantee exact byte sequences. Verified
  with `od -c`: `\r\n`, `\r`-only, and a mix respectively.
- Open: does the parser normalize at the byte/character layer (pre-lex)
  or treat CR and LF as independent tokens? POSIX-leaning answer is
  pre-lex normalization. If so, all three files should produce the
  same AST as their LF equivalent.
- `multiple-trailing-newlines.wit` ends in `\n\n\n`. Does this produce
  one trailing empty paragraph, three, or zero? Spec is silent.

## Whitespace / indentation (PLAN.md I.15)

- I.15 is technically scoped to records, but `leading-whitespace.wit`
  and `tabs-vs-spaces.wit` show that the same question — "does leading
  whitespace carry meaning?" — applies to prose too. Spec p. 5 says
  "indentation is cosmetic" for nodes. Implicitly the same should
  hold for prose, but the fixtures deserve to assert it.
- `tabs-vs-spaces.wit` mixes leading tabs, leading spaces, and a
  `space-tab-space` prefix. Open: is leading whitespace stripped from
  the prose run, preserved verbatim, or normalized (e.g. tab → 4
  spaces)? Each produces a different `text` field in the AST.
- `whitespace-only-line.wit` directly tests whether a line of pure
  whitespace functions as a paragraph break (see above).

## File-edge cases (no PLAN.md entry — new I.review item)

- `empty.wit` is zero bytes. Open: does the parser return an empty
  document, an error, or a document with a single empty paragraph?
- `no-trailing-newline.wit` ends mid-token-stream. Open: does the
  lexer require a terminating newline, synthesize one, or accept EOF
  as an implicit terminator?
- `minimal-non-empty.wit` is the minimal positive case — useful as a
  smoke test that the parser produces *something* for non-empty input.
