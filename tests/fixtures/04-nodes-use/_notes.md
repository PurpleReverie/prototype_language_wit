# 04-nodes-use fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the use side of nodes — `@name ... name@` block, the same
form mid-paragraph as an inline run, the bare reference
`@name` without body or closer, and access paths
`@name.field`. Spec page 5 / example file
`examples/04-using-nodes.wit`:

- `@name` opens a node; the matching `name@` closes it.
- Whether the resulting node renders block or inline is a
  renderer decision, never a writer decision — the AST records
  position (standalone line vs inside a paragraph), not display
  intent.
- A bare `@name` with no body and no closer is a reference to a
  defined entity. The boundary that ends `name` is the open
  question this category is here to surface.
- Identifier characters: letters, digits, underscore, hyphen.
  Dot opens an access path; whitespace and other punctuation
  end the handle.

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

## Bare reference boundary (PLAN.md I.6)

Cross-refs: PLAN.md DS-4, 4.U.3, 4.U.4, J ("Bare-reference
disambiguation" risk, High).

- I.6 asks: "Bare reference vs prose: where does `@weil` end?
  Whitespace? Punctuation?" The risk table marks this High and
  the mitigation is "Require non-word boundary after `@name`;
  document the rule in spec." This category is the first place
  the boundary actually has to bite.
- `bare-reference.wit` is the gentle case — `@weil` is followed
  by a comma. Comma is non-word, the handle ends cleanly.
- `bare-reference-adjacent-prose.wit` is the probe — `@weil
  argued that ...` puts a single space between the handle and
  ordinary prose. Three candidate rules:
  (a) **whitespace-only boundary** — `@weil` ends at the first
      whitespace character; punctuation runs of letters continue
      the handle. Rejected by `bare-reference.wit` where the
      comma already ends `weil`.
  (b) **non-word boundary** — `@weil` ends at the first
      character that is not in `[A-Za-z0-9_-]` (and not `.`
      which would open access). Both fixtures pass cleanly under
      this rule.
  (c) **identifier-character class** — same as (b) but the
      class is `[A-Za-z0-9_]` only, with hyphen NOT a handle
      character. Rejected by `hyphenated-name.wit`
      (`@paper-stats`) which requires hyphen to be a handle
      character.
- **Concrete proposal:** rule (b). The handle character class
  is `[A-Za-z0-9_-]`. Dot opens an access-path segment. Any
  other byte (including whitespace, comma, period at end of
  sentence with no following identifier byte, open-paren,
  pipe) ends the handle. This is the rule both fixtures here
  agree on and the only one that survives `hyphenated-name`
  + `bare-reference` + `bare-reference-adjacent-prose`
  together.
- Open under proposal (b): end-of-sentence period. `Met @weil.`
  parses as `@weil` then `.` (handle ends at the period because
  the period is followed by whitespace/EOL and there is no
  identifier byte after it to extend access). But `@weil.field`
  parses as access. The disambiguator is **lookahead one byte**
  after the dot. Not probed in this category; sentence-final
  dot belongs in a later category once the rule is committed.
- Open under proposal (b): trailing hyphen. `@paper-` followed
  by space — does the handle end at the hyphen (because no
  identifier byte follows) or include the hyphen and then end?
  Not probed; lean: handle is greedy left-to-right, so a hyphen
  with no following identifier byte is still part of the handle
  but the handle reports as `paper-` which is invalid. Better
  to define the class as "must end on a letter, digit, or
  underscore" and treat trailing hyphen as not part of the
  handle. Surface at review.

## `!!` greedy-parse as downstream risk (PLAN.md I.7)

Cross-refs: PLAN.md DS-21, 21.C.4, J ("`!!` greedy parse
swallows prose" risk, High).

- I.7 lists three options for `!!`: (A) context-only, (B)
  always reserved, (C) position-restricted. M1.04 does not
  probe `!!` directly — the short-close form belongs to W4.5,
  which is the next milestone slice for nodes-use.
- Surfacing here as downstream so the reviewer sees the link:
  the bare-reference rule chosen in I.6 constrains the legal
  forms of I.7. If (b) is adopted for I.6, then `@x!!` at the
  end of a sentence (no space) has `!` as a non-handle byte
  that ends the handle, and the next two `!!` are then a
  short-close token. Under (A) for I.7 that token only fires
  when a recognized opener is active; under (B) it always
  fires. The two rules compose; neither this category nor
  M1.04 commits to a resolution.
- Open (no PLAN entry — new I.review item): does the M1.05
  short-close fixture need to re-probe boundary cases like
  `@x!!` (no space) and `@x !!` (space) and `@x.field!!`
  separately? Lean yes — at minimum one fixture per boundary
  shape. Carry forward to the M1.05 briefing.

## Access path legal positions (PLAN.md I.3)

Cross-refs: PLAN.md DS-4, 4.C.6, DS-10.

- I.3 asks where `@name.field` may appear — only in statements
  and params, or also in body prose? `dotted-access.wit` puts
  `@book.title` directly in a prose paragraph, inside a sentence:
  "The title is @book.title for this edition." If the rule is
  "statements / params only," this fixture is illegal. If the
  rule is "anywhere a bare reference is legal," this fixture is
  legal.
- Lean: access paths are legal wherever bare references are
  legal. The example file `examples/15-references/master.wit`
  uses `@book.title` inside both a pipe-parameter value and a
  block body slot, which suggests the access-path syntax is not
  position-restricted at the lexer level — only the resolver
  decides whether the value is renderable in a given context.
- Open (no PLAN entry — new I.review item): does the access
  path support numeric indices in this category, or are those
  deferred to DS-10 `11-data-access`? Lean: lex them the same
  way (`@findings.0.claim`), let the resolver split semantics.
  Not probed here; `dotted-access.wit` uses a single named
  segment.
- Cross-cuts with I.6: the dot itself is the only non-handle
  byte that does NOT end the handle. The dot opens the next
  segment of an access path. After a segment, the same handle
  character class applies until the next dot, whitespace, or
  other non-handle byte.

## Identifier character class (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, 4.U.3, 4.U.5, 4.U.6, I.6.

- Four fixtures probe the character class together:
  - `hyphenated-name.wit` — `@paper-stats` (hyphen, mid-handle).
  - `numeric-suffix.wit` — `@h1`, `@h2` (digit, trailing).
  - `underscored-name.wit` — `@chapter_one` (underscore).
  - `bare-reference.wit` — `@weil` (letters only, baseline).
- Together these argue for the class `[A-Za-z0-9_-]` with the
  additional constraint that the first character is a letter
  (since `@1heading` would clash with numeric scalar parsing in
  some contexts and is not probed). Not committed; surfacing
  here so the reviewer can pick.
- Open (no PLAN entry — new I.review item): can a handle start
  with underscore (`@_private`)? Lean no — leading underscore
  is a definition-side convention in many languages and Wit has
  not committed either way. Not probed.
- Open (no PLAN entry — new I.review item): is the handle
  case-sensitive (`@Weil` ≠ `@weil`)? Lean yes — the resolver
  is exact-match on handles; fuzzy matching is for access path
  segments only (DS-10). Not probed.

## Unicode in handles (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, 4.U.3, I.6, "Identifier character
class" above.

- The concrete proposal (b) under "Bare reference boundary"
  fixes the handle character class as `[A-Za-z0-9_-]`. That
  class is ASCII-only by construction: it excludes every
  non-ASCII letter. Handles like `@café` (Latin-1 e-acute) or
  `@日本` (CJK) would either fail to lex as handles at all or
  truncate at the first non-ASCII byte under proposal (b).
- PLAN.md does not state a Unicode policy on identifiers.
  DS-4 and the 4.U.* sub-items describe the use-side shape of
  handles (`@name`, `name@`, `@name.field`) without committing
  on whether `name` is ASCII-only, NFC-normalised Unicode, or
  some restricted Unicode subset (e.g. UAX #31 identifier
  characters).
- Three rough options for the reviewer:
  (i)   **ASCII-only handles** — keep `[A-Za-z0-9_-]`. Simple
        to lex, simple to compare, but excludes non-English
        author names from the handle itself (`@müller`,
        `@日本`). Authors must transliterate.
  (ii)  **Unicode identifiers, NFC-normalised** — handle is
        any sequence of Unicode letter/digit/underscore/hyphen
        codepoints, normalised on parse. More inclusive; adds
        a normalisation step to the lexer and a comparison
        contract for the resolver.
  (iii) **UAX #31 identifier syntax** — Unicode's published
        identifier rule (XID_Start + XID_Continue). Used by
        Rust, Python 3, Swift. Well-specified; needs a Unicode
        table in the lexer.
- Surface at M1.review so the rule can be picked before any
  Unicode-shape fixture lands. Defer the Unicode probe
  fixtures (`@café.wit`, `@日本.wit`, NFC vs NFD round-trip)
  until the rule is committed — authoring them now would
  prejudge between (i), (ii), and (iii).
- Cross-cuts with I.6: whichever class is picked, the
  boundary rule (proposal (b), "any non-class byte ends the
  handle") still applies; only the class definition changes.

## Closer pairing under shadowing (PLAN.md I.3 + DS-4)

Cross-refs: PLAN.md 4.C.3, 4.U.2.

- `nested-same-name.wit` puts `@x` inside `@x` and closes both
  with `x@`. The intended rule (4.C.3): the inner `x@` matches
  the innermost open `@x`, the outer `x@` matches the
  remaining open `@x`. Stack-based pairing, LIFO.
- Open (no PLAN entry — new I.review item): does the closer
  carry its source location so a renderer can highlight the
  pair? Lean yes — every NodeUse already carries `loc`; the
  pairing is implicit in tree structure. Not probed at the
  fixture level; visible in the snapshot once the parser lands.
- Open (no PLAN entry — new I.review item): if the inner and
  outer open on the same line (`@x @x ... x@ x@`), does the
  block-vs-inline classifier (4.S.2) call both inline because
  neither is standalone, or both block because both open at
  the line level? `nested-same-name.wit` uses standalone lines
  for clarity; an all-on-one-line variant is not in this
  category.

## Empty body (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, 4.C.7.

- `empty-body.wit` is `@x x@` on a single line, nothing
  between. 4.C.7 says: "body is empty array, not null." This
  fixture pins that contract.
- Open (no PLAN entry — new I.review item): is the inter-marker
  space (`@x` SPACE `x@`) part of the body, or stripped? Lean
  stripped — empty body means no children, and a lone space is
  not a child. The contract is "no children," not "no bytes."
  Not committed.
- Cross-cuts with `empty-comment.wit` in 03-comments: same
  shape (empty content between opener and closer), but the node
  case has a stronger commitment from PLAN (4.C.7 says
  explicitly "empty array, not null"). Comments have no parallel
  commitment.

## Inline vs block classification (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-4, 4.S.2.

- `block-name-body.wit` and `inline-name-body.wit` are the
  canonical pair. The block fixture is `@aside` on its own
  line, body, `aside@` on its own line. The inline fixture is
  `@highlight ... highlight@` inside a sentence.
- The classifier rule (4.S.2): "Standalone-line NodeUse →
  block; inside paragraph → inline." Both fixtures are
  intentionally minimal so the snapshot diff shows the
  classifier output without other noise.
- Open (no PLAN entry — new I.review item): what about
  `@aside\nbody\naside@` followed immediately on the next line
  by prose with no blank line between? Is the NodeUse still a
  block, and does the trailing prose become a separate
  paragraph, or do they fuse? Not probed; cross-cuts I.2
  (paragraph boundary on single newline).

## Mismatched-close placement (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md 4.C.4, DS-15.

- The brief offered an optional `mismatched-close.wit`
  (`@x ... y@`). Not authored in this category. 4.C.4 says
  "errors with location of mismatch," which is an error-case
  contract — it belongs in `tests/errors/` (or, by the M1
  layout, in a later category-specific errors directory).
  Surfacing the placement question here:
  (a) author it in `04-nodes-use/` alongside the happy paths,
      with an expected-error annotation;
  (b) author it in `tests/errors/` keyed to error code
      `E_MISMATCHED_CLOSE` (or whatever code DS-15 lands on);
  (c) author it in both — fixture here for AST shape (the
      partial tree before the error), fixture in errors/ for
      the error itself.
- Lean (b). The fixture category for `04-nodes-use/` is the
  happy-path executable spec; error contracts are a separate
  axis. Not authored; defer to the errors directory once
  DS-15 codes are enumerated.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing
  LF. No CR/LF or BOM variants of node-specific cases are
  authored — byte-level probes live in 00-lexical.
- Not probed in this category and deferred:
  - unclosed node running to EOF (4.C.5 — error contract,
    belongs in errors/);
  - parens-only form `@name(params)` (W4.4 — belongs in
    05-nodes-parens);
  - short-close `@name body !!` (W4.5 — belongs in 05 or its
    own slice; surfaces I.7);
  - access path with numeric index `@x.0` (W6.6 / DS-10 —
    belongs in 11-data-access);
  - handle starting with digit (`@1heading`) — not in the
    accepted character class above; surface only if rejected
    explicitly.
