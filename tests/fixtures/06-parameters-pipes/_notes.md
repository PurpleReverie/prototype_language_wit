# 06-parameters-pipes fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the pipe-form of parameter syntax — `@name |slot|` and
`@name\n|slot|\nname@`. Pipes can sit on the open line, scatter
through the body, or appear as a `||` empty token. Pipes are the
only parameter syntax that composes with a body; parens
(05-nodes-parens) are self-closing.
Spec page 6 / example file `examples/05-parameters.wit`:

- Pipe-form is whitespace-delimited inside the bars. The three
  shapes from DS-5 are: positional (single-word slot, no `!`),
  named (`key value`, first word is key, rest is value; hyphen
  ` - ` when the key itself is multi-word), and flag (trailing
  `!` on the slot, any word count).
- PLAN rule confirmed: in `|key value|` the first word is the
  key and the rest is the value. A flag REQUIRES the trailing
  `!`. A bare single-word slot with no `!` is POSITIONAL, not a
  flag and not a key-only named param.
- Pipes can appear at the open (`@scene |mood calm|`), scattered
  through the body (5.C.3 last-one-wins), or as `||` (5.U.7
  empty pipe — error or empty slot).

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
Every fixture in this directory was authored with NO narration
line. All explanatory text lives in this file.

## Multi-word flag scoping (PLAN.md I.12)

Cross-refs: PLAN.md DS-5, 5.U.4, 5.C.4, W5.4,
05-nodes-parens/_notes.md (parity probe).

- I.12 asks: "Multi-word flags via parens: `@badge(full width!)`
  — whole flag or single word?" The pipe-form analogue is
  `|full width!|`, probed by `flag-with-bang.wit`. PLAN 5.C.4
  asserts directly: `|full width!|` → flag.name="full width".
- Three candidate rules (parity with 05-nodes-parens I.12):
  (a) **whole-slot flag** — the slot bytes between `|` and the
      trailing `!|` form one flag whose name is those bytes
      with inner whitespace preserved as a single space run.
      Under (a), `|full width!|` is a flag named `full width`.
  (b) **single-word flag** — only the final word before `!` is
      the flag; preceding words are dropped or error. Under
      (b), `|full width!|` is either the flag `width` with
      stray `full` (error or discarded) or rejected outright.
  (c) **positional-with-bang** — `full width!` is a positional
      value whose final byte happens to be `!`; not a flag.
- **Concrete proposal:** rule (a). Affirms the 05-nodes-parens
  proposal (whole-slot flag) and matches 5.C.4 verbatim. The
  spec text in `examples/05-parameters.wit` ("trailing ! —
  unambiguous regardless of word count" + "multi word flag!")
  is the strongest argument; (a) makes pipes and parens carry
  the same rule. Under (b) or (c), the pipe-form would
  silently diverge from the documented assertion in 5.C.4.
- Open under proposal (a): mid-value `!` is documented (5.U.5,
  `examples/05-parameters.wit`) as "just punctuation; only the
  final `!` before `|` counts." Not probed in this category;
  a future fixture `bang-mid-value.wit` (e.g. `|caption Wow!
  What a lens|`) belongs here once the rule is committed.

## Parameter value quoting (PLAN.md I.4)

Cross-refs: PLAN.md DS-5, 5.U.1–5.U.5,
05-nodes-parens/_notes.md.

- I.4 asks: "Parameter values — always unquoted, or quoted for
  special-char values?" The pipe-form delimiter set is small
  (only `|` and the flag marker `!`), so the pressure is less
  than parens. None of the fixtures in this category contain
  a literal `|` inside a value or rely on quoting.
- `pipe-in-body-text.wit` probes the related question "does a
  pipe-shaped run in body prose look like a slot?" — see the
  dedicated section below. No fixture in this category exercises
  quoting; I.4 stays unprobed at the value level.
- Lean (no commitment): values inside pipes are unquoted and a
  literal `|` inside a value needs an escape mechanism that
  does not yet exist. Three rough options for the reviewer:
  (i)   **no escape; rephrase** — if your value contains `|`,
        rephrase. Cheapest; documents a real expressivity hole.
  (ii)  **backslash escape** — `|caption red \| white|` legal.
        Adds one rule; cross-cuts every other categorical
        delimiter for parity.
  (iii) **quoted-string slot** — `|caption "red | white"|`.
        Adds a quoting layer to the pipe grammar.
- Open (no PLAN entry — new I.review item): mid-value `!` is
  documented safe (5.U.5). Not probed here; surfaces alongside
  the future `bang-mid-value.wit` fixture under I.12 above.

## Mixing parens + pipes (PLAN.md I.11) — downstream

Cross-refs: PLAN.md DS-5, 5.C.5,
05-nodes-parens/_notes.md (the upstream surface).

- I.11 asks: "Mixing parens and pipes on same node — error, or
  merge?" Not exercised in this category. Every fixture here
  uses pipes only; no `@x(a) |b c|` shape is authored. The
  ambiguity surface lives in 05-nodes-parens (parens is the
  self-closing form; pipes is the form that composes with a
  body). Surfacing here as downstream so the reviewer sees
  the link from the pipes side.
- Lean (from 05-nodes-parens): mixing is an error because
  parens self-closes at `)` and pipes implies an open body —
  the two contracts are mutually exclusive. Not committed.
- Open (no PLAN entry — new I.review item): if mixing is
  allowed, what is the resolution order — pipe slots merged
  INTO the parens `Param[]` left-to-right, or appended after,
  or last-one-wins by key? Not probed here; defer to M1.review.

## Bare-positional vs flag (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.3, 5.U.4,
`examples/05-parameters.wit`.

- `bare-positional.wit` is `|full|` inside a `@figure` body.
  `flag-with-bang.wit` is `|full width!|` in the same shape.
  Together the pair pins the question: does a single-word slot
  with no `!` parse as a flag (boolean `full=true`) or a
  positional (`Positional("full")`)?
- The PLAN rule is clear in 5.U.3 (positional single token) and
  5.U.4 (flag REQUIRES trailing `!`). The fixtures encode that
  rule directly. The candidate readings are:
  (a) **positional unless `!`** — `|full|` is `Positional("full")`;
      only `|full!|` is a flag. Matches PLAN.
  (b) **flag unless explicit positional marker** — `|full|` is
      flag `full=true`; positional would need a different
      syntax. Surprising for authors and contradicts 5.U.3.
  (c) **ambiguous; resolver decides via definition** — at parse
      time it is "single-word slot," and `#figure` definition
      shape (W6.*) tells the resolver whether `full` is a flag
      or a positional. Adds a parse/resolve coupling that the
      lexer would prefer to avoid.
- **Concrete proposal:** rule (a). PLAN 5.U.3 + 5.U.4 commit to
  this directly; the fixtures pin it so the snapshot diff
  surfaces any drift. The `!` is the marker. No `!` means no
  flag, period.
- Open under proposal (a): a single-word slot whose word ends
  in `!` from punctuation rather than flag intent (`|stop!|`
  meaning "stop with emphasis" rather than the flag `stop`).
  Lean: `!` immediately before `|` is always the flag marker;
  authors who want literal trailing `!` in prose use the body
  text, not a slot. Not probed in this category.

## Last-one-wins scope (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.C.1, 5.C.3, W5.6,
`examples/05-parameters.wit`.

- `last-one-wins.wit` is `@scene` with `|mood calm|` before the
  first paragraph and `|mood tense|` between paragraphs. PLAN
  5.C.1 says "Multiple pipes per node: collected regardless of
  position; last named wins." PLAN 5.C.3 says "Mid-body pipe
  override: `@scene |a x| ... |a y|` last-one-wins."
  W5.6 asserts the same.
- The candidate readings:
  (a) **node-scoped last-one-wins** — across the entire node
      body, the last occurrence of a key wins. The AST records
      a single `Named(key="mood", value="tense")` and discards
      the earlier `calm`. Matches PLAN directly.
  (b) **paragraph-scoped last-one-wins** — within a paragraph
      the last wins; between paragraphs the value resets. The
      AST records two distinct scopes, one per paragraph.
      Useful only if the renderer wants to attach different
      mood to different paragraphs.
  (c) **append, no override** — both `Named("mood","calm")` and
      `Named("mood","tense")` end up in `Param[]`; resolver
      decides. Easy to author; harder to reason about.
- **Concrete proposal:** rule (a). PLAN 5.C.1 and 5.C.3 commit
  to it; `last-one-wins.wit` pins the assertion in fixture
  form. Renderer-side use cases for (b) (mood changes by
  paragraph) are real but the PLAN reading is unambiguous:
  position is recorded via `loc`, but `Param[]` collapses to
  the last value per key. Not committed; surface at M1.review.
- Open under proposal (a): does positional last-one-wins apply
  the same way? Two `|lamp.png|` slots in one body — is the
  AST `[Positional("lamp.png")]` (deduplicated) or
  `[Positional("lamp.png"), Positional("lamp.png")]` (appended,
  no dedup)? Lean appended; positional has no key to override.
  Not probed in this category.
- Open under proposal (a): flag last-one-wins. `|x!|` then `|x|`
  (single-word no-bang positional) — does the positional
  override the flag, or are they separate slots (flag `x=true`
  + positional `Positional("x")`)? Cross-cuts the bare-positional
  rule above. Not probed.

## Empty pipe `||` semantics (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.7.

- `empty-pipe.wit` is `||` on its own line inside a `@x` body.
  PLAN 5.U.7 asserts: `parsePipeContent("")` empty pipe error:
  "`||` (inside body, not capture) errors clearly." The
  fixture pins the error case so the snapshot diff records
  the diagnostic.
- The classification ambiguity (since the rule cross-cuts
  multiple constructs):
  (a) **empty-pipe is always an error** — `||` is never a
      legal parameter slot. The error model (DS-15) emits a
      diagnostic with the `||` location and the parser
      recovers by skipping the bytes. Matches 5.U.7 verbatim.
  (b) **empty-pipe is the bare flag marker** — `||` means
      "an empty/unnamed flag toggle" with no semantic content;
      legal but useless. Adds a third no-op shape to DS-5.
      Probably nobody wants this.
  (c) **empty-pipe is a capture-list delimiter context-shift**
      — `||` at start-of-line in definition context starts a
      capture list (`||a, b, c||`, per DS-6 / 6.U.1). Inside a
      body (not a definition), `||` reverts to (a) and errors.
      This is the "inside body, not capture" qualifier in
      5.U.7; the fixture sits in body context exactly to pin
      that distinction.
- **Concrete proposal:** rule (a) — error inside body context,
  reserving the `||` token for capture-lists in definitions
  (DS-6). The 5.U.7 qualifier "inside body, not capture"
  reads as exactly this carve-out. Not committed; surface at
  M1.review.
- Open under proposal (a): does the parser tokenize `||` as a
  single 2-byte token or as two `|` tokens with empty content
  between them? Affects the diagnostic shape: "empty pipe"
  vs "unexpected `|` after `|`." Lean single token (cheaper
  recovery, clearer message). Not committed.
- Open: what is `| |` (pipe, space, pipe)? Whitespace-only
  slot. Under (a) and 5.U.1 normalization, the slot trims to
  empty bytes and the rule "empty inside body errors" should
  carry over. Not probed in this category.

## Pipe-shaped text in body (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-1, DS-5, 5.U.7, I.6.

- `pipe-in-body-text.wit` is the line `The signal flag read red
  | white | red across the channel.` inside a `@scene` body.
  The pipe-shaped bytes look like three slots `|`, ` white `,
  `|`, ` red across the channel.` but they sit inside running
  prose with prose on both sides of every `|`.
- The classification ambiguity:
  (a) **slot recognition requires positional context** — `|...|`
      only parses as a slot when it sits at a position the
      parser already expects parameters: on the open line of a
      `@name`, on its own line inside a node body, or
      preceding/following a paragraph in a node body. Inside
      a paragraph, mid-sentence, `|...|` is literal punctuation
      and the bytes flow into the Text node. Matches the spirit
      of 4.S.2 / classifier and I.6 (bare-reference boundary).
  (b) **slot recognition is greedy** — any `|...|` in a node
      body parses as a slot, regardless of position. Under (b)
      the fixture line splits into prose + slot(` white `) +
      slot(` red across the channel.`) + ... — surprising and
      likely unwanted.
  (c) **slot recognition is configurable per node definition**
      — `#scene` definition opts in to pipe-as-slot inside
      paragraphs; other definitions treat them as literal.
      Adds parser/resolver coupling.
- **Concrete proposal:** rule (a). The parser already needs
  position-sensitive classification for the inline/block
  distinction (4.S.2); reusing that machinery for pipe-vs-text
  is the cheap option. Under (a), the fixture is a single
  Paragraph with a Text node containing literal `|` bytes;
  no `Param[]` is collected. Not committed; surface at
  M1.review.
- Open (no PLAN entry — new I.review item): a pipe-shaped run
  on its OWN line inside a node body (`\n| white |\n`) with
  no prose context — is that a slot or a paragraph? Lean
  slot (standalone-line position matches the same line-level
  recognition that pipes use at the open). Not probed here.

## Hyphen-as-separator parity (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.2,
05-nodes-parens/_notes.md (the parity surface),
`examples/05-parameters.wit`.

- `hyphen-multi-word-key.wit` is `|background colour - dark
  slate|` inside a `@panel` body. `literal-hyphen-probe.wit`
  is the pair `|well-known|` (positional with embedded hyphen)
  and `|key - value|` (named with hyphen-as-separator). Both
  fixtures pin the rule documented in 5.U.2 and
  `examples/05-parameters.wit`: "`|key - value|` named —
  hyphen when the key itself is multi-word."
- Three candidate rules (parity with 05-nodes-parens):
  (a) **hyphen-as-separator only when surrounded by spaces** —
      ` - ` (space-hyphen-space) marks the key/value boundary;
      a hyphen with no surrounding spaces (`well-known`) is
      identifier/value bytes. Under (a) the `literal-hyphen-probe`
      fixture parses as `[Positional("well-known"),
      Named(key="key", value="value")]`.
  (b) **hyphen always splits** — any `-` is a separator. Under
      (b) the positional `well-known` splits into key="well"
      and value="known" — breaks the handle-character rule
      in 04-nodes-use (`@paper-stats`) and would surprise.
  (c) **hyphen only when key is two-or-more words** — `-` is
      a separator only when the slot bytes before the first
      space-hyphen-space contain a space. Under (c) `key value`
      and `multi word key - value` both parse named; `well-known`
      with no space does not split.
- **Concrete proposal:** rule (a). Affirms the 05-nodes-parens
  proposal directly; matches the documented pipe-form syntax
  in `examples/05-parameters.wit` (the literal example uses
  ` - ` with spaces); preserves the handle-character invariant
  from 04-nodes-use. The pipe-form is where this rule lives
  natively (parens borrows the convention from pipes per
  DS-5), so committing it here propagates outward.
- Open under proposal (a): a slot whose value is a hyphenated
  word with no key (`|well-known|`) parses positional with
  the hyphen as identifier bytes — `literal-hyphen-probe.wit`
  pins exactly this case. Lean positional. Not committed;
  surface at M1.review.

## Mid-body scatter classification (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.C.1, 5.C.3, W5.6.

- `mid-body-scatter.wit` is `@scene` with `|p first|` before
  the first paragraph, `|p second|` between paragraphs, and
  `|p third|` after the last paragraph (still inside the
  node body). PLAN 5.C.1 says pipes are "collected regardless
  of position." The fixture pins what "collected regardless"
  looks like when the same key appears three times at three
  positions.
- Three candidate classifications:
  (a) **flat collection + last-one-wins** — `Param[]` is one
      `Named(key="p", value="third")`. All three positions are
      collapsed into a single value; `loc` records the LAST
      occurrence. Matches the simplest reading of 5.C.1+5.C.3.
  (b) **flat collection, all three preserved** — `Param[]` is
      `[Named("p","first"), Named("p","second"), Named("p","third")]`.
      Resolver does the dedup. Verifies "collected regardless"
      literally; punts the override to a later pass.
  (c) **position-aware collection** — each slot is attached to
      the nearest paragraph (before-paragraph, between, after).
      The AST records position-tagged slots. Useful for
      paragraph-scoped overrides; contradicts 5.C.1's "regardless
      of position."
- **Concrete proposal:** rule (b) at parse, rule (a) at resolve.
  The parser collects all three (faithful to "regardless of
  position"); the resolver collapses to last-one-wins (faithful
  to 5.C.3). Two passes keep the AST debuggable (you can see
  all three slots before the override) while still giving the
  renderer one value per key. Cross-cuts the last-one-wins
  scope section above; both can be reconciled with the same
  two-pass design.
- Open under the two-pass proposal: where does the override
  logic live in the package layout (DS-19, L)? Lean
  `packages/runtime/resolver.ts` per L. Not committed.
- Open: does the `loc` on the surviving `Named("p","third")`
  point at the third pipe or at the first (the "original"
  declaration)? Lean the third — last-one-wins should make
  the surviving value point at the bytes that produced it.
  Not probed.

## Multi-word key delimiter reconciliation (no PLAN.md entry — new I.review item)

Cross-refs: PLAN.md DS-5, 5.U.1, 5.U.2,
`examples/05-parameters.wit`.

- `basic-named.wit` is `|mood calm|` (single-word key, no
  hyphen). `hyphen-multi-word-key.wit` is `|background colour
  - dark slate|` (multi-word key with ` - `).
  `multi-word-value.wit` is `|caption The second-order Fresnel
  lens|` (single-word key, multi-word value, no hyphen).
  Together these pin the question: how does the parser decide
  where the key ends?
- The rule from 5.U.1 ("first word is key, rest is value") and
  5.U.2 ("hyphen when the key itself is multi-word") composes
  into:
  (a) **first-space-or-hyphen rule** — scan the slot left to
      right. If a space-hyphen-space sequence is found before
      the first plain space, the bytes before ` - ` are the
      key and the bytes after are the value. Otherwise, the
      bytes before the first space are the key and the bytes
      after are the value. Under (a):
        - `mood calm` → key=`mood`, value=`calm`
        - `caption The second-order Fresnel lens` →
          key=`caption`, value=`The second-order Fresnel lens`
        - `background colour - dark slate` →
          key=`background colour`, value=`dark slate`
  (b) **hyphen-required-for-multi-word-key** — same as (a) but
      the hyphen is the ONLY way to express a multi-word key.
      Without ` - `, the key is always one word. (b) is the
      same rule as (a) phrased differently and reduces to (a).
  (c) **greedy-key** — the longest prefix matching an existing
      definition's capture list is the key; remainder is the
      value. Adds parser/resolver coupling.
- **Concrete proposal:** rule (a). Faithful to 5.U.1 + 5.U.2;
  no parser/resolver coupling; the three fixtures snapshot
  the three branches directly. Not committed; surface at
  M1.review.
- Open under proposal (a): a slot containing ` - ` where the
  author intended the hyphen as a literal en-dash in the
  value (`|caption Lamp - lit|`) — under (a) this would
  mis-parse as key=`caption Lamp`, value=`lit`. Cross-cuts
  I.4 (quoting). Lean: authors must rephrase, or use a
  different punctuation, or wait for the escape mechanism.
  Not probed in this category.
- Open: multi-word key with embedded hyphen-letter (`|first-
  pass colour - dark slate|`) — does the ` - ` between
  `colour` and `dark` win because it is the first
  space-hyphen-space, leaving key=`first-pass colour` and
  value=`dark slate`? Lean yes (under (a), only
  space-hyphen-space splits). Not probed.

## File-edge cases deferred (no PLAN.md entry — new I.review item)

- Every fixture in this directory ends with a single trailing
  LF. No CR/LF or BOM variants of pipe-specific cases are
  authored — byte-level probes live in 00-lexical.
- Not probed in this category and deferred:
  - mid-value `!` in a slot (5.U.5 — see I.4 / I.12 above);
  - pipes interleaved with parens on the same node (I.11 —
    see downstream section above);
  - pipe slot containing literal `|` byte (I.4 — see
    "Parameter value quoting" above);
  - `||` in capture-list context (DS-6 / 6.U.1) — the empty
    pipe fixture sits in body context exactly to avoid the
    capture-list overlap;
  - access-path key (`|@scope.field something|`) — not
    probed; access-path semantics inside pipes are deferred
    to W6.6 / DS-10;
  - whitespace-only slot `| |` — not probed; cross-cuts the
    empty-pipe rule.

## M16 known-bug pin: pipes break on newlines

- `multi-line-value.wit` pins the current behaviour: a `|` slot
  containing a `\n` does not span to the next line. The lexer's
  param state (`lexParamState`) breaks on `\n` and the outer parser
  diagnoses `E_UNCLOSED_NODE`. M16 brief notes this as a known bug —
  the fixture's snapshot captures the diagnostic. Fixing the lexer
  to allow newlines inside pipes is deferred to a later milestone.
