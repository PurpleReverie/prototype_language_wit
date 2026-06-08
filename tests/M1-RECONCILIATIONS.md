# M1 reconciliations

Cross-category conflicts surfaced during the M1.review pass, resolved
here so a single rule applies across the corpus. Each section names
the conflicting categories, the unified rule, and the rationale.
Numbers in parens map to PLAN.md section I entries created in the
M1.review lift.

These reconciliations are the canonical resolution; individual
`_notes.md` files retain their original (sometimes pre-reconciliation)
proposals as authoring history. When `_notes.md` and this file
disagree, **this file wins** and M2 (parser) implements the unified
rule below.

---

## R1. Missing-field semantics — hard error vs suppressed-to-falsy

**Conflicting categories.**

- M1.11 / 11-data-access proposes (PLAN.md I.88, M1.11
  `missing-field.wit`): a missing field at access time is a
  **resolution error** with the span of the bad segment and the list
  of present keys.
- M1.12 / 12-conditionals proposes (PLAN.md I.92, M1.12
  `_notes.md` truthy section + empty-body deferral): missing-field
  **is suppressed to falsy** when the access occurs inside an `(if
  ...)` condition operand; the falsy branch is taken silently.

**Unified rule (chosen).** Missing-field is **context-sensitive**:

- Inside a conditional operand (`(if @x.missing)`, `(if @x.missing is
  ...)`, `(if @x.missing equals ...)`): the access evaluates to a
  **suppressed-falsy** sentinel that the conditional treats as false.
  No diagnostic emitted at the access site.
- Inside any other context (body prose, pipe value, record RHS,
  collection item, iteration head, captured `::param::` interpolation
  target, comparison RHS where the LHS is not already conditional-
  guarded): the access produces `E_MISSING_FIELD` at resolve time
  with the span pointing at the missing segment and the list of
  present keys at that depth.

**Rationale.**

M1.12 is right that the whole point of `(if @x.flag)` is for the
author to ask "is this marked?" — answering with a hard error
defeats the construct. M1.11 is right that everywhere else, silent
substitution hides authoring bugs. The rule is one and the same
("missing-field is detectable at the access site") with two
diagnostic dispositions ("raise an error vs return falsy") based on
the surrounding construct.

The mechanism: the resolver tags each access expression with its
**evaluation context** at parse time (one of: `conditional-operand`,
`other`). When an access in `conditional-operand` context misses, it
returns the suppressed-falsy sentinel; when an access in `other`
context misses, it raises. No new syntax is required; the disposition
follows from where the access is written.

**Edge cases pinned.**

- Nested access (`@a.b.c`) where `b` is missing inside a conditional:
  the entire chain short-circuits to falsy without evaluating `c`.
- An access inside a conditional's **then-body** (not the operand)
  that misses: error. The then-body is `other` context.
- An access inside an `(each)` operand: not conditional-operand;
  errors per M1.11 (this is the iteration head, not a guard).
- A comparison `(if @x.missing is "draft")`: the LHS is a
  conditional-operand access, so the LHS misses-to-falsy; the
  comparison evaluates falsy.
- An access whose **root** `@x` is unresolved (no definition
  anywhere): always `E_UNRESOLVED_REFERENCE` (DS-15, PLAN.md I.124).
  The conditional-context falsy rule applies only to missing
  fields/segments on an otherwise-resolved root.

**PLAN.md cross-refs.** I.11, I.88 (was M1.11 lean), I.92 (M1.12
lean). Add to the resolver design under DS-10 / DS-11.

---

## R2. `!!` short-close — definition-only vs use-side block-form

**Conflicting categories.**

- M1.04 / 04-nodes-use defers `!!` as a downstream surface (PLAN.md
  I.7, I.16, I.17); the proposal there carries no commitment on
  whether `!!` works as a use-side close.
- M1.07 / 07-definitions proposes (PLAN.md I.7-resolution, I.17
  downstream): `!!` is **definition-only** — the value-block
  terminator for `#name: value !!` and `#name:\n ... \n!!`. Use-side
  `!!` is an error or literal.
- M1.17 / 17-combinations fixtures `nested-nodes-with-params.wit`
  and `script-injects-rendered-content.wit` propose (PLAN.md I.130):
  `!!` is **dual-role** — closes definition values OR a use-side
  block-form body that has no matching `name@` close.

**Unified rule (chosen).** `!!` is **dual-role with context-sensitive
disambiguation**, matching the M1.17 proposal:

- Inside an open `#name:` or `#name:\n` definition value: `!!`
  terminates the value (the M1.07 use case).
- Inside an open block-form use `@name ... ` with no matching
  `name@` yet emitted: `!!` terminates the use-side body (the M1.17
  use case). This makes `@em the lamp burned !!` a complete
  inline-or-block use of `@em` with body `the lamp burned`.
- Everywhere else (top-level prose, prose inside a non-open
  construct, an `(if)` body, an `(each)` body, a record value, a
  pipe value, a parens-form slot): `!!` is **two literal bang
  bytes**. No reservation, no escape, no error.

**Rationale.**

The DEVIATION from M1.07's lean is deliberate. The decisive cases:

1. `examples/04-using-nodes.wit` and the spec PDF's worked examples
   show `@em the lamp burned !!` patterns. Forcing `em@` here
   produces visually cluttered prose that the spec itself avoids.
2. The combinations fixtures
   (`nested-nodes-with-params.wit`,
   `script-injects-rendered-content.wit`) treat the use-side `!!`
   as live syntax; rejecting it retroactively would force a corpus
   rewrite without buying disambiguation.
3. The disambiguation cost is low: the lexer/parser already tracks
   "currently inside an open `#name:` value" and "currently inside
   an open `@name ...` block-form use." The rule is "`!!` closes
   whichever open construct is innermost," which is the same LIFO
   discipline already chosen for `(end)` in M1.13.
4. M1.07's argument for definition-only is "keeps `!!` semantics
   narrow." But the M1.07 proposal's downstream sections already
   admit that the use-side `!!` belongs in I.7's resolution-space,
   so this reconciliation is a tie-break, not a reversal.

**Edge cases pinned.**

- `!!` in prose outside any open construct: literal bytes (rule
  proposal A from PLAN.md I.7, "context-only," is now the global
  rule).
- Nested block-form use `@outer @inner body !! outer@`: `!!`
  closes the innermost `@inner`, leaving `@outer` still open until
  `outer@`. LIFO.
- Mixed open `#name:` value containing a `@name ... !!` use: `!!`
  closes the innermost `@name` use; the outer `#name:` value
  continues until its own `!!`. Same LIFO.
- Parens-form `@name(p) body !!`: still an error (per I.17 /
  M1.05 lean). Parens-form is strictly self-closing; the `body
  !!` runs are prose. This reconciliation is for the pipe-form
  block-style open/close contract only.
- Definition body containing only `!!` (`#name: !!`): legal,
  empty-string value, per PLAN.md I.58.

**Spec coverage matrix update.** PLAN.md H now records `@name body
!!` short-close as resolved (open in pre-reconciliation; closed
under this section).

**PLAN.md cross-refs.** I.7, I.16, I.17, I.130. Add to the parser
design under DS-4 (use-side) and DS-6 (definition-side); add a
DS-21 row noting the dual-role disposition.

---

## R3. `(if ::param:: is X)` — deferred-evaluation inside definition bodies

**Conflicting categories.**

- M1.12 / 12-conditionals authors all conditionals against
  resolved-data operands (`@x.field`), never against capture
  interpolations (`::param::`). The category's locked semantics
  (PLAN.md I.97 strict-typed equality) assume operands have
  concrete types at parse-into-resolver time.
- tests/integration/report.wit uses `(if ::met:: is true)` inside
  a `#metric` definition body, where `::met::` is a capture not
  bound until the definition is invoked at the use site.

**Unified rule (chosen).** Conditionals inside a definition body
that reference captured names via `::param::` interpolation are
**evaluated at expansion** (at each invocation site), not at parse
or resolve time:

- The parser/resolver records the conditional but does not
  evaluate it; the operand `::param::` stays unresolved in the
  definition's AST.
- When the definition is invoked (`@metric |label X|`), the
  captures are bound to the use-site values and the conditional
  is evaluated against those values, applying the strict-typed
  comparison rule (PLAN.md I.97) at that point.
- All other conditional semantics (operator synonyms, truthy
  rule, nesting, LIFO `(end)` pairing) carry over unchanged.

**Rationale.**

`::param::` is by construction a deferred reference. M1.06's
last-one-wins reading of named pipes and the eager-evaluation
proposal in M1.17 (`definition-with-captures-and-data` —
PLAN.md I.120) both assume captures are bound to their evaluated
scalars at expansion. Conditionals inside a definition body
inherit that timing: the conditional's operand is whatever the
capture evaluates to at the invocation.

This composes cleanly with the rest of the language:

- The strict-typed comparison rule still applies; types are
  determined at the invocation, not at the definition.
- Missing-field-inside-conditional (R1) still applies; if the
  capture itself resolves to a missing-field result at the
  invocation site, the conditional's operand is the suppressed-
  falsy sentinel.
- Definition shape (block / single-line / value-block) is
  orthogonal; the rule applies wherever a definition body can
  hold an `(if ...)`.

**Edge cases pinned.**

- A capture used in BOTH branches of a conditional (`(if ::flag::
  is true) text-a (else) text-b (end)`): evaluates once at
  invocation, picks one branch.
- A capture used in a nested conditional (`(if ::outer::) ...
  (if ::inner::) ... (end) (end)`): each conditional evaluates
  independently at invocation.
- A conditional whose operand is part-`::param::` and part-`@x.y`
  (e.g. `(if @x.y is ::param::)`): the LHS resolves eagerly per
  data-access rules; the RHS evaluates at invocation. Comparison
  fires at invocation.

**PLAN.md cross-refs.** I.7 (capture interpolation), I.97
(strict-typed equality), I.126 (integration confirmation), R1.
Add to the expander design under DS-6 and DS-11.

---

## R4. Resolution timing across constructs

**Conflicting expectations (not a contradiction, but a seam).**

Three different evaluation timings are proposed across the M1.17
combinations fixtures (PLAN.md I.120):

- **Definitions resolve at expansion** (`def-of-def`): every
  invocation re-resolves the body against the then-current
  resolver state.
- **Iterated collections snapshot at iteration entry**
  (`multi-file-with-iteration`): the collection is fixed at the
  `(each)` head; loop body iterations see a stable snapshot.
- **Pipe values eager at use-site**
  (`definition-with-captures-and-data`): pipe value bytes are
  evaluated (including access-path resolution) at the moment the
  invocation is parsed/resolved, before captures bind.

**Unified rule (chosen).** Codify the three timings as **three
distinct stages**, named here, applied uniformly:

1. **Eager (resolve stage).** Pipe values, parens slots, record
   RHS, conditional operands (outside definition bodies),
   `(each)` iteration heads, top-level prose access. The
   resolver computes the value once and binds it.
2. **Expansion-time (expander stage).** Definition body
   interpolation, definition body conditionals against
   `::param::` (R3), captured-value substitution. Re-resolved
   per invocation.
3. **Snapshot (iteration stage).** The collection expression
   inside `(each @x as item)` is evaluated **eagerly** at
   iteration entry, then the resulting sequence is frozen for
   the duration of the loop. Loop body access against `@item`
   uses the snapshot.

The three timings compose cleanly:

- A definition whose body contains an `(each)` over a captured
  collection: the capture binds eagerly at invocation (stage 1);
  the `(each)` snapshots the captured value at entry (stage 3);
  body iteration uses the snapshot.
- A pipe value containing an access path that resolves to a
  collection: eager evaluation produces the collection
  reference, which is then frozen if iterated.

**Rationale.**

The three timings are not in conflict — they describe orthogonal
points in the pipeline. Naming them stage 1 / 2 / 3 makes the
parser/resolver/expander design (PLAN.md C) checkable: each
construct's timing should be documented at its grammar entry.
Mixing the timings is what produces surprising behavior; the
fixtures pinned the natural per-construct timing already.

**Edge cases pinned.**

- A pipe value referencing a definition whose body mutates
  (additive partial extends it): the eager evaluation captures
  the resolver state at use-site, which includes all `+#name`
  contributions visible at that point. Order of declaration
  in the reference graph (PLAN.md I.69 depth-first) determines
  what is visible.
- An iterated collection that is itself the result of a
  definition body: the iteration head expression is evaluated
  eagerly (stage 1) using the expansion of the definition; the
  snapshot freezes the expanded collection.

**PLAN.md cross-refs.** I.120, I.123, R3. Add to PLAN.md C
(architecture) as a new sub-section "Timing per construct."

---

## R5. `!!` token disambiguation precedence

**Composite reconciliation.** Following R2 (`!!` is dual-role) and
R3 (deferred-evaluation conditionals), the lexer/parser sees `!!`
in four possible roles. The precedence (innermost-context-wins,
LIFO) is:

1. If an open `@name ...` use-side block-form body is the
   innermost open construct: `!!` closes the use-side body.
2. Else if an open `#name:` value (single-line or value-block) is
   the innermost open construct: `!!` closes the definition value.
3. Else if the bytes immediately preceding `!!` form a flag-shape
   slot inside an open parens or pipe (per PLAN.md I.45 / I.49):
   the trailing `!` is the flag marker; the second `!` is the
   next byte (which then must satisfy slot-termination rules per
   I.4).
4. Else: two literal bang bytes.

**Rationale.** Disambiguation by innermost open context, LIFO,
matches the existing rule for `(end)` (PLAN.md I.103) and the new
rule for unified `!!`. No new lookup table is required; the
lexer/parser already tracks open constructs.

**PLAN.md cross-refs.** I.7, I.45, I.49, R2.

---

## Summary

| # | Conflict | Decision | Drives |
|---|---|---|---|
| R1 | Missing-field in conditional operand vs other contexts | Suppress-to-falsy inside conditional operands; error elsewhere | Resolver context-tagging |
| R2 | `!!` definition-only (M1.07) vs use-side block-form short-close (M1.17) | Dual-role with LIFO context disambiguation | Lexer state machine |
| R3 | `(if ::param:: is X)` inside definition body — timing | Defer evaluation to expansion (invocation) | Expander stage |
| R4 | Three different resolution timings across constructs | Codify as three named stages (eager / expansion / snapshot) | C-section architecture doc |
| R5 | `!!` token disambiguation precedence | Innermost-open-construct wins (LIFO) | Lexer precedence rule |
