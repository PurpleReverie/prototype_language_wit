# 14-composition fixtures — authoring notes

Bulleted log of ambiguities surfaced while writing these fixtures.
No decisions here — see M1.review.

Scope: the `reference ./path.wit` directive that pulls
definitions and data from another file into the current file's
scope. Probes path resolution (relative, `..`, subdir),
transitive visibility, self-reference, cycles, missing files,
and `reference`-vs-use ordering.

Layout: this category mixes single-file and multi-file probes.
Each subdirectory is one self-contained scenario; the entry
point is usually `master.wit` (or `parent.wit` / `x.wit` where
the scenario reads more naturally that way).

Narration discipline: per `tests/fixtures/README.md`, narration
`~ ...` inside `.wit` is forbidden from `03-comments/` onward.
All fixtures in this directory were authored with NO narration;
explanatory text lives in this file.

## Forward references resolved at expansion (PLAN.md I.8)

`forward-then-back/master.wit` uses `@keeper` on line 1 BEFORE
its `reference ./later.wit` directive on line 3. `later.wit`
defines `#keeper`. Cross-ref: DS-1 (definitions), DS-8
(composition), I.8.

- (a) Affirm I.8 across files: the union of all `#name`
  definitions in the reference graph is hoisted; order of
  `reference` directives relative to use sites is irrelevant.
- (b) `reference` directives must precede first use in the
  same file (textual ordering).

**Concrete proposal:** (a) — affirm I.8. Cross-file is the
same model as in-file: all `#`-bound names hoist within the
graph. Position of `reference` inside the file does not gate
visibility.

## Definition scope global within ref graph (PLAN.md I.9)

`multiple-references/master.wit` consumes `@year`, `@keeper`,
`@place` defined across `a.wit` and `b.wit`. Cross-ref: DS-1,
DS-8, I.9.

- (a) Affirm I.9: the transitive closure of `reference`
  directives forms one flat namespace; every `#name` defined
  anywhere in the closure is visible everywhere in it.
- (b) Per-file namespaces; references import only explicitly
  named symbols.

**Concrete proposal:** (a) — affirm I.9. Per-file imports
would need an import-list grammar that doesn't yet exist in
the surface and would force redundant re-listing for
chapter/schema patterns (see `shared-schema/`).

## Path resolution (no PLAN.md entry — new I.review item)

`single-reference/`, `nested-subdir/`, and `parent-relative/`
together probe the relative-path surface: same-dir
(`./one.wit`), child dir (`./sub/x.wit`), parent dir
(`../parent.wit`). Cross-ref: DS-8.

- (a) Paths are POSIX-style, always relative to the
  referencing file's directory. Leading `./` required for
  same-dir; `../` for parent; bare `name.wit` (no prefix) is
  illegal.
- (b) Bare `name.wit` is allowed and means same-dir.
- (c) Absolute paths (`/...`) are allowed.

**Concrete proposal:** (a) — explicit `./` and `../`,
relative to the referencing file. Forbid bare and absolute
forms. The leading `./` makes the directive unambiguous and
parallels common module-resolution conventions; absolute
paths break portability across checkouts.

## Transitive reference visibility (no PLAN.md entry — new I.review item)

`transitive-references/`: `master.wit` references `a.wit`;
`a.wit` references `b.wit`; `master.wit` uses `@place` which
is defined only in `b.wit`. Cross-ref: DS-8, I.9.

- (a) Visibility is transitive: master sees b through a. The
  reference graph is fully flattened before expansion.
- (b) Visibility is one-hop: master sees a's own defs but not
  b's; master must re-`reference ./b.wit` explicitly.

**Concrete proposal:** (a) — transitive. Matches the "global
within ref graph" reading of I.9. One-hop would force every
consumer to re-declare its transitive dependencies, which
defeats the schema-sharing pattern in `shared-schema/`.

## Self-reference handling (no PLAN.md entry — new I.review item)

`self-reference/x.wit` has `reference ./x.wit` at its own
top. Cross-ref: DS-8.

- (a) Self-reference is a no-op (or: an edge of the cycle
  detector that resolves immediately). The file is treated as
  already-visited.
- (b) Self-reference is an error (cycle of length 1).
- (c) Self-reference is silently allowed and re-parses the
  file (must terminate via cycle detection regardless).

**Concrete proposal:** (a) — no-op via "already-visited"
shortcut. The author may have copy-pasted, or generated the
directive from a template; treating it as an error punishes
benign cases, while infinite recursion is impossible because
any sane resolver memoizes visited files.

## Circular reference detection (no PLAN.md entry — new I.review item)

`circular-references/`: `a.wit` references `b.wit`; `b.wit`
references `a.wit`. Master enters via `a`. Cross-ref: DS-8.

- (a) Cycles of length ≥ 2 are errors. Resolver reports the
  cycle path (e.g., `a.wit → b.wit → a.wit`).
- (b) Cycles unroll once: the second visit short-circuits
  (memoized) and definitions from both files merge.
- (c) Cycles are unconditional errors regardless of length
  (subsumes the self-reference case above).

**Concrete proposal:** (b) — unroll via memoization. Once
the graph is flattened to its set of unique files, evaluation
order doesn't matter (definitions hoist per I.8/I.9), so a
cycle is operationally indistinguishable from a DAG that
re-converges. This keeps (a)-style errors out of legitimate
"both files reference a common shared file" patterns. If
authors prefer strictness, (a) can be added later as an opt-in
lint.

## Missing file error shape (no PLAN.md entry — new I.review item)

`missing-file/master.wit` references `./nonexistent.wit`.
Cross-ref: DS-8.

- (a) Hard error at parse/resolve time. Error names the
  referencing file, the unresolved path, and the resolved
  absolute path attempted.
- (b) Warning + skip; `@keeper` then surfaces as an unbound
  reference (which is itself an error from DS-1 / I.review).

**Concrete proposal:** (a) — hard error, naming both the
referencing file and the attempted path. (b) compounds one
error into two and hides the root cause behind a downstream
unbound-reference diagnostic.

## `reference` position in file (no PLAN.md entry — new I.review item)

`forward-then-back/master.wit` places its `reference`
directive AFTER prose that uses an imported name. Cross-ref:
DS-8, I.8.

- (a) `reference` may appear anywhere at the top level of a
  file; relative position to use sites is immaterial
  (hoisting handles it).
- (b) `reference` directives must appear before any prose or
  other content (preamble-only).
- (c) `reference` directives must appear before any USE of an
  imported name (textual-ordering rule).

**Concrete proposal:** (a) — anywhere at top level. Matches
the hoisting model used by `#`-definitions in 07; forcing a
preamble is an extra rule with no operational benefit once
the graph is flattened.

## Reference resolution order (no PLAN.md entry — new I.review item)

`multiple-references/` and `shared-schema/` raise the
question of evaluation order: does the resolver walk depth-
first, breadth-first, or in source order? Cross-ref: DS-8,
I.9. With the (a)-flavored answers above (hoisting +
flattening), the order is operationally invisible — but the
spec still needs to pick a normative walk for diagnostics
(which file is "responsible" for a duplicate, which cycle
edge is reported first, etc.).

- (a) Depth-first, in the order `reference` directives appear
  in each file. Deterministic and easy to explain.
- (b) Breadth-first by file (BFS over the reference graph).
- (c) Unspecified; renderers MAY choose.

**Concrete proposal:** (a) — depth-first, source-order. Easy
to reason about for diagnostics ("a → b → a" reads like the
file you wrote) and matches how most module resolvers walk.

## Cross-cutting: duplicate definitions across files (deferred)

Not probed in this category — all fixtures define each `#name`
in exactly one file. Whether `a.wit` and `b.wit` defining the
same `#keeper` is an error, last-write-wins, or first-write-wins
is a question for `08-additive-partials/` interactions and
should be picked up by I.review when this category is reviewed
against 08.

## Authoring invocations

All fixtures authored as plain LF-terminated UTF-8 via the
editor. No byte-sensitive cases (CRLF, bare CR, BOM,
no-trailing-LF) in this category — those belong to
`00-lexical/`.
