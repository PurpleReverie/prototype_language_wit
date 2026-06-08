# 15-scripting — notes

Category covers the JavaScript escape hatch: block `<% %>` scripts, inline
`<% expr %>` interpolation, and `@scriptCall(fn, ...)` to invoke
script-defined functions. The `lh` bridge surface tested:
`lh.data`, `lh.query`, `lh.node`, `lh.sort`, `lh.inject`, `lh.set`,
`lh.prose`. Spec refs: PLAN E.1 A8.*, DS-13, DS-14.

## PLAN.md I.10 — lh.set mutability (overlay vs mutate AST)

`lh-set-value.wit` calls `lh.set('paper.word count', 1200)` against a
record `#paper` whose original value is `0`, then reads back via
`lh.data.paper['word count']` inline. Question: does `lh.set` mutate the
parsed AST in place, layer an overlay consulted by later reads, or both
(write-through overlay)?

**Concrete proposal:** rule (b) — overlay only. The AST stays the
canonical parse result; `lh.set` writes to a script-scoped overlay
consulted by `lh.data` reads during the post-parse script phase.
Rationale: parse stays referentially transparent for tooling (LSP,
diffing); mutation effects are contained to the script pass; round-trip
serialisation can omit overlays unless asked.

## PLAN.md I.13 — @scriptCall calling convention

`script-call-node.wit` writes `@scriptCall(greet, "world")` — function
identifier first, positional string arg second. Open: is the function
name a bareword (resolved against the script scope) or a string? Are
args positional only, named only (param pipes), or both?

**Concrete proposal:** rule (a) — bareword function ref, positional
args using node-parameter parens syntax (no `|` pipes; pipes are for
node defs, not call sites). Rationale: consistent with `@node(arg)`
visual shape; named args would collide with parameter-syntax expectations
elsewhere (see 06-parameters-pipes).

## Inline `<% %>` legal positions

`inline-script.wit` uses `<% expr %>` inside flowing prose. Not tested:
inline `<% %>` inside a node parameter value, inside a definition
right-hand side, or inside a record value. Question: where exactly is
inline script legal?

**Concrete proposal:** rule (a) — inline `<% expr %>` legal anywhere a
prose text run is legal (i.e. wherever raw text could go), but not
inside structural positions like node names, key names, or `+#` partial
keys. Rationale: keeps grammar boundary at the lexical level — script is
a prose-token, not a structural-token.

## Script run ordering — document order or topological by data deps?

`multiple-script-blocks.wit` has two `<% %>` blocks separated by prose;
the second reads what the first wrote. Question: do blocks run strictly
in document order, or does the engine compute a dep graph?

**Concrete proposal:** rule (a) — strict document order, single pass,
top to bottom. Rationale: predictable, no hidden re-runs; matches author
mental model of "scripts execute as the parser walks past them"; topo
ordering would require dataflow analysis the parser shouldn't carry.

## lh bridge surface stability — exhaustive list, or extensible?

Fixtures touch `lh.data`, `lh.query`, `lh.sort`, `lh.inject`, `lh.set`.
Not exercised: `lh.node`, `lh.prose`. Question: is the seven-method
surface frozen, or may host applications extend `lh.*`?

**Concrete proposal:** rule (c) — frozen core (the seven listed in the
task brief) plus a host-namespaced `lh.host.*` escape for app-specific
extensions. Rationale: keeps Wit-the-language portable across hosts
while allowing experimentation without polluting the core bridge.

## `<% %>` content opacity — does parser ever look inside?

`block-script-basic.wit` and others put arbitrary JS — template strings,
backticks, function decls — between `<%` and `%>`. Question: does the
parser tokenise the inside, or treat it as opaque bytes until the
closing `%>`?

**Concrete proposal:** rule (b) — opaque bytes, terminated by the first
`%>` outside of a JS string/template literal. The parser MUST track JS
string state (single, double, backtick, regex) to avoid premature close;
beyond that, no Wit tokenisation inside. Rationale: alternative (pure
bytes scan for `%>`) breaks any JS that emits `"%>"` in a string.

## Script errors — propagate up, swallow, or fail expansion?

`script-with-no-effect.wit` throws on a missing precondition. Question:
when a script throws, does expansion abort, emit a diagnostic and skip
the block, or silently swallow?

**Concrete proposal:** rule (a) — propagate as a fatal diagnostic; the
document is considered un-expanded. Rationale: scripts are
author-controlled and effectful; silently swallowing produces output
that doesn't match author intent. A future `try` wrapper at the script
layer can opt into recovery.

## @scriptCall arity / argument syntax (no PLAN.md entry — new I.review item)

Related to but distinct from I.13: how are zero-arg vs many-arg calls
spelled? `@scriptCall(foo)` for zero args is in `script-call-node.wit`
(implicitly via `greet, "world"`); fixture does not cover
`@scriptCall(foo)` with no args, or many args.

**Concrete proposal:** rule (a) — comma-separated positional args in
parens; empty parens required for zero-arg (`@scriptCall(foo)` =
zero-arg call of `foo`, NOT a reference). Rationale: removes the
"is this a call or a ref" ambiguity; consistent with JS call syntax
that script authors already know.
