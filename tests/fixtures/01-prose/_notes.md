# 01-prose fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: pure prose only. Emphasis (`_x_`, `*x*`), comments beyond a single
narration line, nodes (`@`), defs (`#`), and short-close (`!!`) all live
in later categories and are deliberately absent from every fixture below.

## Soft line break vs collapse (PLAN.md I.2)

- `soft-line-break.wit` is the primary probe for I.2. A single `\n` sits
  between two halves of one sentence with **no** blank line. The two
  defensible behaviors:
  - **Collapse**: the newline becomes a single space; the paragraph
    contains one `Text` run, `"…eleven days, and his silence…"`.
  - **Preserve**: the paragraph contains either a `SoftBreak` inline or
    a `Text` with an embedded `\n`; renderers decide whether to show it.
  Spec PDF (the prose section) does not commit; PLAN §1.U.2 explicitly
  flags this as open ("collapse to space — or preserved").
- `blank-line-splits.wit` is the contrast case: same words, but with a
  blank line where the soft break used to be. This MUST yield two
  paragraphs (PLAN §1.U.1, "two-or-more consecutive newlines mark a
  paragraph boundary"). The pair is intentional — diffing the two
  fixtures isolates exactly what one extra `\n` buys you.
- `long-single-line.wit` has no internal newlines at all and so does
  not participate in I.2. It exists to assert that line length alone is
  not a paragraph signal.

## Markdown-ish leaders are not block syntax (PLAN.md W1.4 / DS-1 row 1.C.5)

- `markdown-ish-leaders.wit` opens lines with `>`, `*`, `-`, and `1.` —
  each in its own paragraph. None of these should activate a
  blockquote, bullet, or ordered-list parse. Wit has no such blocks.
- Open: should each of these lines parse as a single `Text` run that
  begins with the literal leader character, or should the leader be
  stripped/normalized? Lean **literal** — the writer typed it on
  purpose — but the fixture is silent on the choice.
- Cross-cuts with 02-emphasis: the `*` leader here is the same byte as
  the bold opener. Decision at column 0 needs a rule that `*` followed
  by whitespace is not a bold opener. Surfacing here so 02-emphasis can
  add the inverse fixture.

## Punctuation, quotes, numerics, URLs (PLAN.md W1.3, W1.5)

- `punctuation-heavy.wit` packs em-dash, apostrophe, colon, and
  semicolon into one sentence. None are reserved in prose; the file
  exists to lock that in before someone is tempted to overload `:` for
  records or `;` for statement termination.
- `quoted-prose.wit` uses both `"..."` and `'...'` mid-prose. Open: do
  matched quote pairs round-trip verbatim, or does the lexer attempt
  smart-quote substitution? Lean verbatim; spec is silent.
- `numbers-and-arithmetic-shapes.wit` contains three shapes that look
  syntactic in other languages:
  - `1970. It was` — a year followed by a period and a space. Reads
    almost identically to a markdown ordered-list item ("1. Foo"); the
    fixture pins it as prose (see also `markdown-ish-leaders.wit`).
  - `5*6*7` — three digits glued by `*`. PLAN §2.U.4 promises bold
    tokenization will reject this; the fixture is the *prose-side*
    assertion that even before emphasis exists, the run is plain text.
  - `3.14` — a decimal literal embedded in prose. Open: does the lexer
    distinguish a "number-shaped" token within a `Text` run, or is the
    entire run opaque? Spec is silent; lean opaque.
- `urls-in-prose.wit` contains `https://example.com/x?y=1` and a
  `mailto:keeper@example.org` shape. The `@` in the mailto address is
  worth flagging: PLAN §I.6 ("where does `@weil` end?") suggests the
  parser will need a non-word-boundary rule for `@`. A mid-word `@`
  preceded by alphanumerics (as in an email) should not start a
  NodeUse. Fixture surfaces this; 04-using-nodes will assert the
  positive cases.

## Tilde mid-line (PLAN.md I.1 / DS-3 row 3.U.3)

- `tilde-mid-line.wit` contains `~/Documents` and `~6 hours`, both with
  the tilde NOT in column 0. PLAN §3.U.3 already promises that mid-line
  tildes do not start comments; this fixture is the prose-side
  assertion of the same rule, written before 03-comments lands.
- Open (carrying over from 00-lexical `_notes.md`): even when the
  comment marker IS in column 0, are comment lines AST nodes or
  elided? Not probed here — every fixture in 01-prose uses at most a
  single narration line, and that line is the first line of the file,
  so its treatment is uniform.

## Paragraph-break semantics carried forward (PLAN.md I.2)

- `multi-paragraph.wit` and `blank-line-splits.wit` both rely on the
  single-blank-line-is-a-boundary rule from 00-lexical. Repeated here
  intentionally — 01-prose readers should not have to cross-reference
  00-lexical to know what splits a paragraph.
- None of the 01-prose fixtures intentionally contains
  whitespace-only-but-not-empty lines; that probe stays in 00-lexical
  (`whitespace-only-line.wit`). If the resolution of I.2 forces a
  rewrite, expect a follow-up fixture here.

## Narration comments (carry-over from 00-lexical)

- Per `tests/fixtures/README.md`, narration `~ ...` inside `.wit`
  files is still permitted in 01-prose. Most fixtures here open with
  one narration line; `blank-line-splits.wit` opens with two. The
  comment marker itself is not under test in this category.
- From 03-comments onward this convention is locked out; reviewers
  should not propagate the style further.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing LF.
  No-trailing-LF, CRLF, and bare-CR variants of prose-specific cases
  are deliberately not authored here — the byte-level probes already
  live in 00-lexical and re-doing them per category would duplicate
  surface without surfacing new questions. If a prose-specific
  byte-edge case appears at review, add it then.
