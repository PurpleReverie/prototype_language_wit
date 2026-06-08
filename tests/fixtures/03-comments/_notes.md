# 03-comments fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the two comment forms — line-leading `~ ` and block
`~~ ... ~~/` — plus the tilde-prose discriminator. Spec page 4 /
example file `examples/03-comments.wit`:

- `~~` always opens an inline (block) comment, even at line start.
- `~ ` (tilde followed by whitespace) at line start opens a line
  comment running to end-of-line.
- `~~/` closes a block comment. A bare `~~` inside an open block is
  content, so writers may use it as a divider.
- A tilde attached to a token (`~5`, `~/path`, `x~y`) is plain prose.

This is the FIRST category where narration `~ ...` inside a `.wit`
is forbidden by `tests/fixtures/README.md`. Every tilde in every
fixture is test input; no fixture explains itself. All explanatory
text lives in this file.

## Comment AST node vs elision (PLAN.md I.1)

Cross-refs: PLAN.md DS-3, I.1, 3.C.2.

- I.1 asks "Are comments AST nodes or fully elided?" DS-3 promises
  comments are "recognized, retained as AST, elided from render."
  These two together imply nodes in the tree and zero output from
  the renderer — but the in-tree shape (single `Comment` kind, or
  separate `LineComment` / `BlockComment`?) is not committed.
- `line-leading-comment.wit` and `inline-comment.wit` are the two
  canonical probes. If snapshots later collapse comments to nothing,
  the diff will be visible here first. Lean: distinct node kinds,
  retained with their text payload and loc.
- Open (no PLAN.md entry — new I.review item): does a comment node
  carry trivia (leading/trailing whitespace, newline that follows a
  line comment) on itself, on its neighbour, or on neither? Not
  probed by any fixture — surfaces only when the parser lands.

## Line vs block trigger rule (PLAN.md I.1)

Cross-refs: PLAN.md DS-3.

- `line-leading-comment.wit` pins `~ ` at column 0 as a line
  comment. The space after the tilde is load-bearing per the
  example file ("`~` followed by whitespace at line start opens a
  line comment"). A bare `~` followed immediately by a non-space
  character at column 0 is NOT probed here — that case is part of
  the discriminator baseline (`~5`, `~/path`).
- `inline-comment.wit` pins `~~` mid-line as a block opener with
  `~~/` as its closer on the same line. Per the example file's
  rule "`~~` always opens an inline comment, even at line start,"
  a `~~` at column 0 would also open a block, not a line comment.
  Not probed: a `~~` at column 0 on its own line. Add when the
  trigger rule is committed.
- Open (no PLAN.md entry — new I.review item): is the
  whitespace-after-tilde requirement for line comments exactly one
  space, any horizontal whitespace, or any non-word character?
  Lean: any horizontal whitespace (space or tab). The current
  fixture uses a single space.

## Block comments spanning lines (PLAN.md I.1)

Cross-refs: PLAN.md DS-3, W3.3.

- `multi-line-block-comment.wit` opens with `~~` at column 0, runs
  three lines of indented content, closes with `~~/` mid-line, and
  follows with a blank line and a prose paragraph. PLAN W3.3 calls
  for "a multi-line comment spanning paragraphs"; the fixture spans
  lines within one would-be paragraph rather than crossing a blank
  line.
- Open (no PLAN.md entry — new I.review item): may a block comment
  cross a blank line? The 02-emphasis rule (2.C.2) says marks
  cannot span blank lines; the comment rule may differ because
  comments are not inline marks. Spec is silent. Lean: blocks may
  cross blank lines freely, since the closer is explicit. Not
  probed; add a fixture once the rule is committed.
- Open (no PLAN.md entry — new I.review item): does the indented
  content inside an open block preserve its leading whitespace in
  the AST payload, or is it normalized? Not probed; visible only
  in the snapshot once the parser lands.

## Internal `~~` as a free divider (PLAN.md I.1)

Cross-refs: PLAN.md W3.4.

- `internal-double-tilde-in-block.wit` puts three segments inside
  one block, separated by bare `~~` runs. Per the example file:
  "plain `~~` inside an open comment is just content, so the
  writer can use it as a divider however they like."
- The intended rule: once a block is open, only the literal `~~/`
  three-character sequence closes it. The lexer must scan for the
  closer specifically, not for any `~~` run.
- Open (no PLAN.md entry — new I.review item): is the internal
  `~~` preserved verbatim in the comment payload, or split into
  divider tokens? Lean verbatim — the AST payload is the bytes
  between opener and closer, full stop. The "divider" framing in
  the example is cosmetic, not structural.

## Path safety inside comments (PLAN.md I.1)

Cross-refs: PLAN.md W3.5.

- `path-safety-in-comment.wit` puts `~/Documents/notes` and
  `~/.bashrc` inside an open block. Per the example file: "shell
  paths inside comments are safe — `~~/` is the close, not `~/`."
  The closer is exactly three characters; a `~/` (tilde-slash) on
  its own does not close.
- The intended rule, restated: the closer is the literal sequence
  `~ ~ /` (no spaces, no break). Any `~/` not preceded by a second
  `~` is comment content.
- Open (no PLAN.md entry — new I.review item): what about `~~~/`
  (three tildes then slash) inside an open block — is that closer
  + stray tilde, or stray tilde + closer? Not probed; lean
  leftmost-longest meaning the first two tildes plus the slash
  form the closer and the trailing context resumes prose. Add a
  fixture once the rule is committed.

## Tilde-prose discriminator (PLAN.md I.1)

Cross-refs: PLAN.md W3.6, and 01-prose `tilde-digit-mid-line.wit`
/ `tilde-slash-mid-line.wit`.

- `tilde-discriminator-baseline.wit` collects the three negative
  cases from the example file in one paragraph: `~5` (tilde +
  digit, "approximately"), `~/Documents` (tilde + slash, shell
  path), and `x ~ y` (tilde flanked by spaces, "approximately
  equal"). None of these are comment triggers.
- Cross-category fragility: the 01-prose fixtures
  `tilde-digit-mid-line.wit` and `tilde-slash-mid-line.wit`
  already pin two of the three cases at mid-line position. This
  fixture pins them as a group and adds the spaces-flanking case
  (`x ~ y`) that 01-prose did not cover. If the tokenizer rule
  for tilde changes, snapshots in both categories revalidate
  together.
- Open (no PLAN.md entry — new I.review item): the case
  `~half-heartedly~` from the example file (tilde-wrapped word,
  no whitespace around outer tildes) is not in this fixture. It
  pins tilde-as-prose-punctuation rather than tilde-as-comment
  and could be its own fixture; deferred until the discriminator
  rule is named.
- Open (no PLAN.md entry — new I.review item): `~ ` at column 0
  IS a line comment, but `~ ` mid-line (after non-comment prose)
  is prose. The mid-line case is implicit in the closer of
  `inline-comment.wit` (the `~~/` is mid-line) but a bare line-
  comment-shaped run mid-line is not probed.

## Empty comment (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-3.

- `empty-comment.wit` is `~~ ~~/` on a single line, no
  surrounding prose. Three candidate behaviors:
  (a) legal — empty `Comment { payload: "" }` (or `" "`,
      depending on how the inter-marker space is treated);
  (b) error — emit `E_EMPTY_COMMENT` (or similar) with loc;
  (c) collapse — comment node absent from the tree entirely.
  Lean (a). DS-3 says "retained as AST," which argues for keeping
  even an empty node. M1.review will pick.
- Cross-cuts with `empty-marks.wit` in 02-emphasis: that file
  raised the same legality question for `__` and `**`. The
  comment-empty case is qualitatively different because the
  opener and closer are different sequences (`~~` vs `~~/`) —
  there is no ambiguity about whether the run is empty.
- Open (no PLAN.md entry — new I.review item): is there a
  minimum content width? `~~~~/` (no space at all between opener
  and closer) is the tighter form; not probed.

## Comment as joiner vs separator at line boundary (PLAN.md I.1)

Cross-refs: PLAN.md I.1, I.2.

- `comment-between-prose-lines.wit` is a three-line file: prose,
  line comment, prose. No blank lines anywhere. Per the
  paragraph-boundary rule (I.2) blank lines split paragraphs;
  this fixture has none.
- Candidate behaviors for the resulting AST:
  (a) **joiner** — one paragraph with two prose runs and a
      comment node between them; the two prose lines glue into
      a single Paragraph after the comment is elided from
      rendering;
  (b) **separator** — two paragraphs, the comment line counted
      as a paragraph boundary even though it is not blank;
  (c) **transparent** — the comment is skipped at the line level
      and the two prose lines collapse as if adjacent (per the
      I.2 soft-break / collapse rule);
  (d) **comment-as-its-own-paragraph** — three paragraphs, one
      of which renders to nothing.
  Lean (a). DS-3 ("elided from render") plus I.2-lean
  (single-newline collapse) compose cleanly: one paragraph in
  the AST, comment node retained inside it, render output is
  one paragraph of joined prose.
- This probes I.1 and I.2 simultaneously; the AST shape cannot be
  pinned without committing to both. Flagging here so reviewers
  resolve them as a pair.

## Closer positional restrictions (no PLAN.md entry — new I.review item)

- The fixtures here use the closer `~~/` in three positions:
  - end of line (`multi-line-block-comment.wit` — closer at
    end of the third comment line, but followed by a blank
    line and prose);
  - mid-line, followed by space then more comment content that
    is itself ended by another `~~/`: no such case in this
    category;
  - mid-line, followed by space then prose (`inline-comment.wit`
    closes mid-sentence, prose resumes after one space).
- Not probed: closer immediately followed by punctuation
  (`~~/.`), closer at column 0 on its own line, closer with no
  preceding space inside the comment. These should be probed
  once it is decided whether closer recognition is purely
  byte-sequence-based or context-sensitive.

## Narration discipline (PLAN.md README §"Narration comments inside fixtures")

- Per `tests/fixtures/README.md`: from `03-comments/` onward,
  narration `~ ...` inside `.wit` is forbidden. Every fixture in
  this directory was authored with NO narration line. Reviewers:
  if a fixture here grows a narration line in a later edit, that
  line is now part of the test, not a comment on it.
- The example file `examples/03-comments.wit` itself uses
  narration headings (`~ line comments`, `~ inline comments`,
  `~ what does NOT trigger a comment`) that read as
  human-facing but are, by the rule, also test input from the
  parser's perspective. We did not import those headings into
  the fixtures; each fixture is single-purpose and unannotated.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing LF.
  No CR/LF or BOM variants of comment-specific cases are authored
  — byte-level probes live in 00-lexical. If a comment-specific
  byte-edge case appears at review (a `~~/` split across a CRLF,
  a BOM immediately before a `~~` opener), add it then.
- Not probed in this category and deferred to a later milestone:
  unclosed block comments running to EOF, nested block comments
  (lean: not nestable; the example file rules `~~` inside an open
  block as content), and the interaction of comments with the
  short-close `!!` (depends on I.7).
