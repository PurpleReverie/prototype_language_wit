# Wit — project plan

The comprehensive plan for the Wit project: vision, architecture, milestones, user stories, dev stories, TDD stories (utility / state / composition), open design questions, risks, and operational concerns.

Companion to `wit-spec.pdf` (canonical language reference) and `examples/` (narrative feature introduction).

---

## A. Vision & scope

### What Wit is at v1.0

- A parser library (TypeScript) that takes `.wit` source and returns a typed, source-located AST.
- A small runtime (resolver + expander) that resolves references and inlines definitions.
- A reference renderer (HTML).
- A VS Code extension with semantic highlighting and minimal LSP (errors, hover, go-to-definition).
- A test corpus that locks language behavior — the executable spec.
- Documentation: the spec PDF (canonical), narrative examples (`examples/`), and an introductory guide.

### Non-goals

- Not a renderer-defining language. Wit produces a tree; the renderer decides HTML/CSS/visual form.
- Not Turing-complete on its own. `<% %>` is the explicit escape hatch for general computation.
- Not a templating engine for arbitrary string interpolation.
- Not a CMS or authoring environment. Wit is a file format.
- Not an inline rich-text editor language.

---

## B. Audiences

| Audience | Primary concern | Surface they touch |
|---|---|---|
| Writer | Stay in prose; structure visible but unobtrusive | Surface syntax only |
| Author-programmer | Composability, predictable expansion, debuggability | Definitions, data, control flow, scripting |
| Renderer author | Stable AST, query helpers, source locations | AST + `lh` bridge |
| Tool author | Error model, serializable AST, fast reparse | Parser API, error types |
| Integrator | Minimal deps, deterministic output, versioning | Library packaging |

---

## C. Architecture

Five stages, each independently testable and replaceable:

```
source string
   ↓ Lexer            tokens with source locations
   ↓ Parser           raw AST (invocations unresolved)
   ↓ Resolver         bound AST (every @x linked to its #x)
   ↓ Expander         expanded AST (definitions inlined, conditions/loops evaluated)
   ↓ Renderer         output (HTML / JSON / typeset / game tree)
```

**Rationale.** Renderers consume any post-Expander AST. Tools that only need structure (LSP, formatters) stop after Parser or Resolver — they don't need expansion. Each stage is independently testable.

**Source locations** propagate through every stage. Every AST node carries `{ file, line, col, length }`.

### Module layout

```
packages/
  parser/          lexer, parser, AST types, errors
  runtime/         resolver, expander, lh bridge
  render-html/     reference renderer
  vscode/          extension + LSP server
  cli/             wit build / wit parse / wit check
tests/
  fixtures/        .wit + .json snapshot pairs
  integration/     whole-document tests
  errors/          .wit + .err.json pairs
  runner/          vitest harness
```

---

## D. Milestones

| ID | Name | Deliverable | Success criteria |
|---|---|---|---|
| M0 | Foundations | TS scaffold, fixture skeleton, AST types drafted | `pnpm test` runs cleanly; types compile |
| M1 | Language lock | All fixture `.wit` files written; spec questions resolved | Fixtures exist for every feature; PDF v0.2 |
| M2 | Lexer + Parser MVP | Parser handles 80% of fixtures | Categories 00–04 snapshot-green |
| M3 | Parser complete | All fixtures + integration parse | Categories 00–17 + integration green; error model done |
| M4 | Resolver + Expander | References bind, partials merge, conditions/loops evaluate | Integration tests render to expected expanded tree |
| M5 | VS Code extension | Highlighting via LSP, squiggles, go-to-def | Extension installable; daily-driver usable |
| M6 | Reference renderer | HTML output from any expanded AST | One worked example renders to readable HTML |
| M7 | 1.0 | Docs site, published packages, versioned spec | npm + VSIX published; spec v1.0 frozen |

---

## E. User stories

Numbered for cross-reference. Organized by audience.

### E.1 Writer (W)

#### Prose
- **W1.1** Write a paragraph without typing any markup.
- **W1.2** Have multiple paragraphs separated by blank lines.
- **W1.3** Write punctuation, numbers, URLs without triggering syntax.
- **W1.4** Start a line with `>`, `*`, `-`, `1.` and have it stay prose.
- **W1.5** Have my prose render as-typed — no accidental control characters.

#### Emphasis
- **W2.1** Mark a word italic with `_word_`.
- **W2.2** Mark a word bold with `*word*`.
- **W2.3** Use apostrophes near italic without breaking the mark.
- **W2.4** Use `*` in arithmetic (`5*6*7`) without triggering bold.
- **W2.5** Use `_` in identifiers in prose without triggering italic.

#### Comments
- **W3.1** Add a line comment with `~ ` at the start of a line.
- **W3.2** Add an inline comment mid-sentence.
- **W3.3** Add a multi-line comment spanning paragraphs.
- **W3.4** Use internal `~~` as a visual divider in a longer comment.
- **W3.5** Reference a shell path like `~/Documents` inside a comment without breaking it.
- **W3.6** Use ordinary tildes in prose without triggering a comment.

#### Node use
- **W4.1** Drop in a callout / aside / pullquote.
- **W4.2** Use a node inline mid-sentence.
- **W4.3** Reference a defined entity bare.
- **W4.4** Self-close a parameterised node with `@name(params)`.
- **W4.5** Use `!!` short-close for tight inline nodes.

#### Parameters
- **W5.1** Pass a single-word named parameter.
- **W5.2** Pass a multi-word value.
- **W5.3** Pass a multi-word key with hyphen.
- **W5.4** Pass a boolean flag with trailing `!`.
- **W5.5** Pass parameters in parens at the opening.
- **W5.6** Change a parameter mid-body with last-one-wins.

#### Records & collections
- **W6.1** Define a record with named fields.
- **W6.2** Use a multi-line record for many fields.
- **W6.3** Define a collection of values.
- **W6.4** Define a collection of records.
- **W6.5** Reach into a record field via dot access.
- **W6.6** Reach into a collection by index.
- **W6.7** Have fuzzy key matching tolerate snake / space / camel.

#### Iteration & self-organisation
- **W7.1** Iterate over a collection and render each item.
- **W7.2** Have my TOC populate itself as chapters register entries.
- **W7.3** Have my bibliography populate itself.
- **W7.4** Reorder chapters and have numbering follow.

#### Composition
- **W8.1** Split chapters into separate files.
- **W8.2** Share a schema file across chapters.
- **W8.3** Share a sources file across chapters.
- **W8.4** Add a chapter by creating a file and referencing it.

#### Citations
- **W11.1** Define a citation schema once.
- **W11.2** Name sources and reuse them.
- **W11.3** Build an argument map — name ideas, not pages.
- **W11.4** Cite by idea in prose.

#### Definitions / vocabulary
- **W12.1** Define my own block node.
- **W12.2** Define a single-line shorthand entity.
- **W12.3** Capture parameters in a definition.
- **W12.4** Interpolate captured values in the definition body.
- **W12.5** Mark where the invocation body should render.
- **W12.6** Define a multi-line value spanning multiple lines.

#### Conditionals & drafts
- **W13.1** Show content only when a flag is set.
- **W13.2** Choose between two blocks based on a value.
- **W13.3** Use `is` or `equals` as natural-language comparisons.
- **W13.4** Switch a document between draft and final via a flag.

#### Genre-specific
- **W14.1** Write a screenplay scene with slug lines, action, cues.
- **W14.2** Write a branching dialogue with choices.
- **W14.3** Gate dialogue branches on game state.
- **W14.4** Pull a figure with a caption into a chapter.

### E.2 Author-programmer (A)

#### Defining templates
- **A1.1** Define a template that captures multiple parameters.
- **A1.2** Interpolate captures into child-node parameters.
- **A1.3** Provide a body slot at a specific position.
- **A1.4** Mix interpolation and body slot in one template.

#### Control flow
- **A2.1** Conditionally render based on a static data value.
- **A2.2** Provide an else branch.
- **A2.3** Nest conditionals.
- **A2.4** Compare with `is` / `equals`.

#### Iteration
- **A3.1** Iterate over a collection of records.
- **A3.2** Iterate over a collection of values.
- **A3.3** Access loop-variable fields.
- **A3.4** Nest iterations.

#### Data access
- **A4.1** Access a record field with snake / space / camel interchangeably.
- **A4.2** Access a collection element by numeric index.
- **A4.3** Chain access (`@x.y.z`).
- **A4.4** Detect missing fields with a clear error.

#### Scripting
- **A8.1** Embed a script block that runs once after parse.
- **A8.2** Read parsed data via `lh.data`.
- **A8.3** Query nodes via `lh.query`.
- **A8.4** Sort instances via `lh.sort`.
- **A8.5** Inject computed content via `lh.inject`.
- **A8.6** Update data values via `lh.set`.
- **A8.7** Use inline scripts for one-shot expressions.
- **A8.8** Call a script-defined function from prose via `@scriptCall`.

#### Composition
- **A7.1** Split a document across many files.
- **A7.2** Share schemas / sources / definitions via references.
- **A7.3** Register entries to shared partials.
- **A7.4** Have the document self-assemble at render time.

### E.3 Renderer author (R)

- **R1.1** Walk the AST recursively.
- **R1.2** Map each node name to a component.
- **R1.3** Query all nodes of a given type regardless of nesting.
- **R1.4** Get source locations on every node.
- **R1.5** Get a typed AST with exhaustive discriminated unions.
- **R1.6** Distinguish block vs inline node usage.
- **R1.7** Access resolved data records as plain JS objects.

### E.4 Tool author (T)

- **T1.1** Errors include file + line + column + stable error code.
- **T1.2** Errors carry a machine-readable category.
- **T1.3** Serialize any AST to JSON for diffing / inspection.
- **T1.4** Re-parse on every keystroke with sub-100ms latency on medium documents.
- **T1.5** Get incremental reparse hooks (post-1.0).
- **T1.6** Plug in custom validators.

### E.5 Integrator (I)

- **I1.1** Depend on the parser with zero transitive runtime dependencies.
- **I1.2** Same input → same output, every time.
- **I1.3** Pin to a parser version that targets a specific spec version.
- **I1.4** Use the parser in Node / Bun / Deno / browser environments.

---

## F. Dev stories

Capabilities we must build. Each derived from one or more user stories.

| ID | Capability | Serves |
|---|---|---|
| **DS-1** | Prose runs separated by blank lines become `Paragraph` nodes | W1.* |
| **DS-2** | Inline emphasis triggers only when marks wrap a token, never from mid-prose punctuation | W2.* |
| **DS-3** | Comments (`~`, `~~ ~~/`) recognized, retained as AST, elided from render | W3.* |
| **DS-4** | Node invocations capture name, params, body, inline-vs-block, source location | W4.*, R1.* |
| **DS-5** | Parameters resolve via pipes and parens into a unified `Param[]` | W5.* |
| **DS-6** | Definitions are templates with captures, interpolation, body slot | W12.*, A1.* |
| **DS-7** | Additive partials (`+#x`) merge across files | W7.2/3, A7.3 |
| **DS-8** | References (`reference ./path.wit`) resolve relative paths; circular detection | W8.*, A7.* |
| **DS-9** | Records and collections parse to JS-shaped data | W6.*, R1.7 |
| **DS-10** | Dot access supports fuzzy-matched keys | A4.1 |
| **DS-11** | Conditionals (`if/else/end`) evaluate against static data with `is` / `equals` / bare truthy | W13.*, A2.* |
| **DS-12** | Iteration (`each as`) walks collections and unrolls bodies | A3.* |
| **DS-13** | Script blocks (`<% %>`) embed JS; runs once via `lh` bridge | A8.1–A8.6 |
| **DS-14** | Inline scripts and `@scriptCall(fn)` connect prose to script-defined functions | A8.7, A8.8 |
| **DS-15** | Errors expose file + line + column + stable code; every parser branch can fail typed | T1.1, T1.2 |
| **DS-16** | AST is serializable JSON; cycles only via reference, not by structure | T1.3, R1.5 |
| **DS-17** | Parser handles 10k-line document in <100ms | T1.4 |
| **DS-18** | Parser package has zero runtime dependencies | I1.1 |
| **DS-19** | Determinism: same input + same definitions → same output AST | I1.2 |
| **DS-20** | Spec-versioned parser tags target a spec PDF version | I1.3 |
| **DS-21** | `!!` short-close as an alternative to named close for inline node bodies | W4.5 |

---

## G. TDD stories — utility / state / composition

Each TDD story is a testable unit. Category: **U**tility (pure functions), **S**tate (data shape / invariants), **C**omposition (pipeline integration).

Enumerated comprehensively below. New entries added incrementally per feature as we hit each milestone.

### DS-1 — Prose

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 1.U.1 | U | `findBlankLineBoundary(input)` | Two-or-more consecutive newlines mark a paragraph boundary |
| 1.U.2 | U | `normalizeProseRun(text)` | Single internal newline collapses to space (or preserved — see I.2) |
| 1.S.1 | S | `Paragraph { kind, children: Inline[], loc }` | Type compiles, discriminated union exhaustive |
| 1.C.1 | C | Multi-paragraph integration | `"p1\n\np2"` → two `Paragraph` nodes |
| 1.C.2 | C | Trailing whitespace tolerance | Whitespace-only lines treated as blank |
| 1.C.3 | C | Leading whitespace tolerance | Indented prose still parses as paragraph |
| 1.C.4 | C | Empty input | Document with zero children |
| 1.C.5 | C | Punctuation-heavy prose | Lines starting with `>`, `*`, `-`, `1.` parse as prose |

### DS-2 — Emphasis

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 2.U.1 | U | `tokenizeItalic(input, pos)` | `_word_` returns token; `_` mid-word fails |
| 2.U.2 | U | `tokenizeBold(input, pos)` | `*word*` returns token; `*` mid-word fails |
| 2.U.3 | U | Punctuation boundary | `_word_'s` recognizes mark + apostrophe-s |
| 2.U.4 | U | Arithmetic guard | `5*6*7` produces no bold tokens |
| 2.U.5 | U | Empty mark | `__`, `**` are not emphasis |
| 2.S.1 | S | `Italic { content }` | Shape compiles |
| 2.S.2 | S | `Bold { content }` | Shape compiles |
| 2.C.1 | C | Mixed prose + emphasis | Paragraph contains `Text, Italic, Text, Bold, Text` |
| 2.C.2 | C | Marks across paragraphs | Mark cannot span blank line — closes implicitly or errors |
| 2.C.3 | C | Nested marks | `*_x_*` and `_*x*_` resolve cleanly |

### DS-3 — Comments

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 3.U.1 | U | `tokenizeLineComment(input, pos)` | `~ ` at line start opens; ends at newline |
| 3.U.2 | U | `tokenizeInlineComment(input, pos)` | `~~` opens; `~~/` closes; internal `~~` allowed |
| 3.U.3 | U | Tilde-prose discriminator | `~5`, `~/`, `x ~ y` mid-prose do NOT trigger |
| 3.S.1 | S | `Comment { text, inline, loc }` | Shape compiles |
| 3.S.2 | S | Lexer mode stack supports `in-comment` | State machine includes mode |
| 3.C.1 | C | Single inline comment | Paragraph contains `Text + Comment + Text` |
| 3.C.2 | C | Multi-comment paragraph | Two comments parsed; one text run between |
| 3.C.3 | C | Path safety | `~~ TODO save to ~/Documents ~~/` parses as single comment |
| 3.C.4 | C | Multi-line comment | Comment spans paragraph boundary |
| 3.C.5 | C | Internal `~~` divider | `~~ a ~~ b ~~ c ~~/` parses as one comment with divisions noted |

### DS-4 — Node use

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 4.U.1 | U | `parseNodeOpen(input, pos)` | Recognizes `@name`; respects identifier boundary |
| 4.U.2 | U | `parseNodeClose(input, pos, name)` | Recognizes `name@` with matching name |
| 4.U.3 | U | Identifier boundary | `@weil_attention` matches whole; `@weil.field` matches `weil` then `.field` |
| 4.U.4 | U | Bare reference disambiguation | `@weil argued` — `@weil` ends at whitespace |
| 4.U.5 | U | Hyphenated names | `@paper-stats` is one node |
| 4.U.6 | U | Numeric suffix | `@h1`, `@h2` recognized |
| 4.S.1 | S | `NodeUse { name, params, body \| null, inline, loc }` | Shape compiles |
| 4.S.2 | S | Block vs inline classifier | Standalone-line NodeUse → block; inside paragraph → inline |
| 4.S.3 | S | `closeStyle: 'named' \| 'short' \| 'parens' \| 'bare'` | Records how the node was closed |
| 4.C.1 | C | Basic block node | `@x\nbody\nx@` → NodeUse with body=[Paragraph(body)] |
| 4.C.2 | C | Inline node mid-paragraph | Paragraph contains `Text + NodeUse + Text` |
| 4.C.3 | C | Nested same-name | `@x @x x@ x@` parses to two-deep tree |
| 4.C.4 | C | Mismatched close errors | `@x ... y@` errors with location of mismatch |
| 4.C.5 | C | Unclosed node errors | `@x ...` (no close) errors at EOF, points at handle |
| 4.C.6 | C | Dotted access | `@x.y` parses as NodeReference with access path |
| 4.C.7 | C | Empty body | `@x x@` — body is empty array, not null |

### DS-5 — Parameters

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 5.U.1 | U | `parsePipeContent("mood calm")` | Named: key=`mood`, value=`calm` |
| 5.U.2 | U | `parsePipeContent("background colour - dark slate")` | Multi-word key via hyphen |
| 5.U.3 | U | `parsePipeContent("lamp.png")` | Positional single token |
| 5.U.4 | U | `parsePipeContent("full width!")` | Flag with trailing `!`, name=`full width` |
| 5.U.5 | U | `parsePipeContent("caption Wow! Hello")` | Mid-value `!` is NOT a flag marker |
| 5.U.6 | U | `parseParensContent("a, b c, d - e f, g!")` | Comma-separated; same per-slot rules apply |
| 5.U.7 | U | Empty pipe error | `\|\|` (inside body, not capture) errors clearly |
| 5.S.1 | S | `Param` discriminated union | Positional / Named / Flag variants exhaustive |
| 5.S.2 | S | `ParamSource = 'parens' \| 'pipes'` | Records which syntax was used |
| 5.C.1 | C | Multiple pipes per node | Collected regardless of position; last named wins |
| 5.C.2 | C | Parens self-closing | `@badge(tone good)` no body, no close |
| 5.C.3 | C | Mid-body pipe override | `@scene \|a x\| ... \|a y\|` last-one-wins |
| 5.C.4 | C | Multi-word flag | `\|full width!\|` flag.name="full width" |
| 5.C.5 | C | Mixing parens + pipes | Per design decision (see I.11) |

### DS-6 — Definitions

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 6.U.1 | U | `parseCaptureList("\|\|a, b, c\|\|")` | Returns `["a","b","c"]` |
| 6.U.2 | U | `parseInterpolation("::name::")` | Returns interpolation token |
| 6.U.3 | U | `parseBodySlot("...")` | Recognized at appropriate positions |
| 6.U.4 | U | `parseSingleLineDefValue` | Captures content from `:` to `!!` |
| 6.S.1 | S | `NodeDef { name, captures, body, shape, additive, loc }` | Shape compiles |
| 6.S.2 | S | `Interpolation { name, loc }` AST node | Discrete inline node |
| 6.S.3 | S | `BodySlot { loc }` AST node | Marker node |
| 6.S.4 | S | `shape: 'block' \| 'single-line' \| 'value-block'` | Tracks definition flavour |
| 6.C.1 | C | Definition with captures and body slot | Template structure preserved in AST |
| 6.C.2 | C | Single-line def `#name: value !!` | Definition shape `single-line`; value is body |
| 6.C.3 | C | Multi-line def `#name:\n...\n!!` | Definition shape `value-block`; multi-line value |
| 6.C.4 | C | Definition referencing another definition | Resolves at expansion |
| 6.C.5 | C | Unclosed definition errors | `#x ...` without `x#` errors with loc |

### DS-7 — Additive partials

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 7.U.1 | U | `parsePartialPrefix("+#name")` | Marks definition additive=true |
| 7.S.1 | S | `NodeDef.additive: boolean` | Field on node |
| 7.C.1 | C | Multiple `+#bibliography` declarations | Merge into single AST node after resolution |
| 7.C.2 | C | Cross-file merge | Two files contributing to same partial unified |
| 7.C.3 | C | Partial with non-mergeable body errors | Structural bodies refuse merge |
| 7.C.4 | C | Partial ordering | Children appear in document/reference order |

### DS-8 — References / composition

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 8.U.1 | U | `parseReferenceDirective("reference ./path")` | Captures path string |
| 8.U.2 | U | `resolveRelativePath(file, path)` | Path resolution including `..` |
| 8.S.1 | S | `Reference { path, loc }` AST node | Shape compiles |
| 8.S.2 | S | Resolver tracks file graph | Adjacency map |
| 8.C.1 | C | Multi-file integration | Master + chapters resolves cleanly |
| 8.C.2 | C | Missing file errors | Clear message + loc |
| 8.C.3 | C | Circular reference detection | Reports cycle path |

### DS-9 — Records & collections

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 9.U.1 | U | `parseRecordInline("{ a - 1, b - 2 }")` | Returns `Record { a:1, b:2 }` |
| 9.U.2 | U | `parseRecordMultiLine(input)` | Indented multi-line parses correctly |
| 9.U.3 | U | `parseCollectionInline("[a, b, c]")` | Returns Collection |
| 9.U.4 | U | `parseCollectionMultiLine(input)` | Multi-line of records |
| 9.U.5 | U | `parseScalar("31")` | Number; `parseScalar("true")` Bool; else String |
| 9.U.6 | U | Trailing comma tolerance | Works in both records and collections |
| 9.S.1 | S | `Record { fields: { key, value }[] }` | Shape compiles |
| 9.S.2 | S | `Collection { items: Value[] }` | Shape compiles |
| 9.S.3 | S | `Value = string \| number \| boolean \| Record \| Collection` | Union exhaustive |
| 9.C.1 | C | Nested records | Record inside record parses correctly |
| 9.C.2 | C | Record inside collection | Common case for tables |
| 9.C.3 | C | Multi-word keys | `years at post - 31` parses |
| 9.C.4 | C | Empty record / collection | `{ }`, `[ ]` are legal |

### DS-10 — Data access

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 10.U.1 | U | `fuzzyMatchKey(target, candidate)` | snake / space / camel all match |
| 10.U.2 | U | `parseAccessPath("@x.y.0.z")` | Sequence of segments parsed |
| 10.S.1 | S | `AccessPath = string[]` | Segments are names or numeric indices |
| 10.C.1 | C | Field access | `@keeper.name` resolves |
| 10.C.2 | C | Index access | `@findings.0.claim` resolves |
| 10.C.3 | C | Fuzzy access | `@keeper.years_at_post` resolves `years at post` |
| 10.C.4 | C | Missing field errors | Clear error with loc |
| 10.C.5 | C | Chained deep access | `@x.y.z.w` works to any depth |

### DS-11 — Conditionals

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 11.U.1 | U | `parseCondition("@x.y is foo")` | Returns Condition with op=`is` |
| 11.U.2 | U | `parseCondition("@x.y equals foo")` | Same shape, op=`equals` |
| 11.U.3 | U | `parseCondition("@x.y")` | Truthy form |
| 11.S.1 | S | `IfStatement { cond, then: Block[], else?: Block[] }` | Shape compiles |
| 11.S.2 | S | `Condition = Compare \| Truthy` | Union exhaustive |
| 11.C.1 | C | If/end | Block conditional |
| 11.C.2 | C | If/else/end | With alternate |
| 11.C.3 | C | Nested ifs | Nest two-deep |
| 11.C.4 | C | Unmatched `(end)` errors | Surface loc |
| 11.C.5 | C | Truthy conditional | `(if @author.corresponding)` evaluates presence |

### DS-12 — Iteration

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 12.U.1 | U | `parseEachStatement("(each @x as item)")` | Returns EachStatement |
| 12.S.1 | S | `EachStatement { collection, item, body }` | Shape compiles |
| 12.C.1 | C | Each over collection of values | Body repeats |
| 12.C.2 | C | Each over collection of records | Item is a record |
| 12.C.3 | C | Nested each | Two-deep nesting |
| 12.C.4 | C | Each + if combination | Conditional inside loop |
| 12.C.5 | C | Empty body in each | Legal, produces zero output per item |

### DS-13 — Script blocks

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 13.U.1 | U | `tokenizeScriptBlock(input, pos)` | `<%` opens; `%>` closes; opaque content |
| 13.U.2 | U | `tokenizeInlineScript(input, pos)` | Mid-line `<% %>` recognized |
| 13.S.1 | S | `ScriptBlock { content, inline, loc }` | Shape compiles |
| 13.S.2 | S | `lh` bridge interface defined | Methods: `data`, `query`, `node`, `sort`, `inject`, `set`, `prose` |
| 13.C.1 | C | Block script after document | Parses; runs at expansion |
| 13.C.2 | C | Inline script in paragraph | Inline node |
| 13.C.3 | C | Multiple script blocks | All run in document order |

### DS-14 — Inline scripts / scriptCall

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 14.U.1 | U | `parseScriptCall("@scriptCall( fn )")` | Returns ScriptCall |
| 14.S.1 | S | `ScriptCall { fnName, args, loc }` | Shape compiles |
| 14.C.1 | C | Script call invocation | Inline node calls fn defined by inline script |

### DS-15 — Error model

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 15.U.1 | U | `WitError { code, message, loc }` | Shape compiles |
| 15.U.2 | U | `formatError(err)` | Human-readable string |
| 15.S.1 | S | Stable error codes enumerated | `E_UNCLOSED_NODE`, `E_MISSING_REF`, etc. |
| 15.C.1 | C | Errors directory regression | Every error fixture matches expected error code + loc |

### DS-16 — Serializable AST

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 16.U.1 | U | `serialize(ast): JSON` | Round-trips through JSON |
| 16.S.1 | S | No cyclic structure | Resolver replaces refs with handles, not pointers |
| 16.C.1 | C | Snapshot diff stable | Same input → byte-identical JSON |

### DS-17 — Performance

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 17.U.1 | U | Bench scaffold | Measures parser throughput |
| 17.C.1 | C | 10k-line fixture parses <100ms | Benchmark assertion |

### DS-18 — Zero deps

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 18.S.1 | S | `packages/parser/package.json` has no `dependencies` field | Lint check |

### DS-19 — Determinism

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 19.U.1 | U | Deterministic key iteration | Sorted; no random ordering |
| 19.C.1 | C | Same input → same AST in N runs | Stochastic determinism check |

### DS-20 — Spec versioning

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 20.U.1 | U | `spec.version` tag in package | Version string accessible |
| 20.C.1 | C | Version match | Parser CI validates target spec version |

### DS-21 — Short-close `!!`

| ID | Cat | Shape | Assertion |
|---|---|---|---|
| 21.U.1 | U | `tokenizeDoubleBang(input, pos)` | `!!` recognized |
| 21.S.1 | S | NodeUse `closeStyle: 'short'` for `!!`-closed | Field set correctly |
| 21.C.1 | C | Short-close inline | `@em x !!` parses to NodeUse with body, closeStyle=short |
| 21.C.2 | C | Short-close stack discipline | `@em x @strong y !! z !!` pairs by depth |
| 21.C.3 | C | Bare `!!` in prose | When no node open, `!!` is two exclamation marks |
| 21.C.4 | C | Greedy-parse safety | Pending design resolution (I.7) |

---

## H. Spec coverage matrix

| Construct | Fixture dir | Dev story | Spec status |
|---|---|---|---|
| Prose paragraph | 01-prose | DS-1 | ✓ |
| `_italic_` | 02-emphasis | DS-2 | ✓ |
| `*bold*` | 02-emphasis | DS-2 | ✓ |
| `~` line comment | 03-comments | DS-3 | ✓ |
| `~~ ~~/` inline | 03-comments | DS-3 | ✓ |
| `@name name@` block | 04-nodes-use | DS-4 | ✓ |
| `@name body !!` short-close | 04-nodes-use | DS-21 | Open (see I.7, I.16, I.17) |
| `@name(params)` self-close | 05-nodes-parens | DS-4, DS-5 | ✓ |
| `\|key value\|` pipe param | 06-parameters | DS-5 | ✓ |
| `\|flag!\|` | 06-parameters | DS-5 | ✓ |
| `#name name#` def | 07-definitions | DS-6 | ✓ |
| `#name: value !!` | 07-definitions | DS-6 | ✓ |
| `+#name` partial | 08-additive | DS-7 | ✓ |
| `{ }` record | 09-records | DS-9 | ✓ |
| `[ ]` collection | 10-collections | DS-9 | ✓ |
| `@x.y` access | 11-data-access | DS-10 | ✓ |
| `(if … end)` | 12-conditionals | DS-11 | ✓ |
| `(each … as … end)` | 13-iteration | DS-12 | ✓ |
| `reference ./x` | 14-composition | DS-8 | ✓ |
| `<% %>` block | 15-scripting | DS-13 | ✓ |
| `<% %>` inline | 15-scripting | DS-14 | Spec gap |
| `@scriptCall(fn)` | 15-scripting | DS-14 | Spec gap |

---

## I. Open design questions

Each must be resolved during M1 (driven by fixture writing).

1. Are comments AST nodes or fully elided?
2. Single newline within a paragraph — collapse to space, or preserve as a soft break?
3. Where can `@name.field` access appear — only in statements/params, or also in body prose? Boundary rule?
4. Parameter values — always unquoted, or quoted for special-char values?
5. Numeric literals in records — distinguished type, or just strings?
6. Bare reference vs prose: where does `@weil` end? Whitespace? Punctuation?
7. `!!` greedy-parse risk in body prose. Options:
   - **A.** Context-only — `!!` only terminates when a recognized opener is active.
   - **B.** Always reserved — escape with `\!!` to use as prose punctuation.
   - **C.** Position-restricted — `!!` legal only at end-of-line or before whitespace.
8. Forward references — `@x` before `#x`? Lean yes (hoisted definitions).
9. Definition scope — file-local or merged across references? Lean global within reference graph.
10. `lh.set(...)` and immutability — mutate AST or layered overlay?
11. Mixing parens and pipes on same node — error, or merge?
12. Multi-word flags via parens: `@badge(full width!)` — whole flag or single word?
13. `@scriptCall(fn)` — builtin or generic? Calling convention?
14. Source locations across additive partials — file-tagged child nodes?
15. Indentation in records / collections — required for multi-line or cosmetic?
16. Short-close `!!`: inline-only, or block-allowed?
17. Combining `!!` close with parens (`@name(p, q) body !!`) — allowed?

### Lifted from M1 fixture _notes.md (M1.review)

#### Lexical / whitespace / line endings
18. Whitespace-only line: paragraph boundary or content? (00-lexical)
19. Trailing newlines at EOF: one empty paragraph, many, or none? (00-lexical)
20. Newline normalization order — pre-lex CR/CRLF/LF normalization vs after splitting? (00-lexical)
21. Empty `.wit` input: empty document, error, or single empty paragraph? (00-lexical)
22. No-trailing-LF policy: require, synthesize, or accept? (00-lexical)
23. Leading whitespace on prose lines: strip, preserve, or normalize tabs? (00-lexical)

#### Emphasis word-boundary
24. Word-character class for `_`/`*` emphasis flanking — `[A-Za-z0-9]` lean; Unicode policy unresolved. (02-emphasis)
25. Empty marks `__` / `**` — literal text, error, or empty-emphasis node? (02-emphasis)
26. Three-or-more adjacent mark chars (`***x***`, `_**x**_`) — precedence rule. (02-emphasis)
27. Smart-quote substitution policy at apostrophe boundaries. (01-prose, 02-emphasis)

#### Comments
28. Comment-line as paragraph joiner vs separator vs transparent — see I.1 + I.2 composite. (03-comments)
29. Comment trivia ownership: who owns leading/trailing whitespace? (03-comments)
30. Whitespace-after-tilde for line comment: single space, any horizontal whitespace, or any non-word? (03-comments)
31. Block comment crossing blank line: legal or not? (03-comments)
32. Internal `~~` divider preservation policy (verbatim bytes or split-into-tokens). (03-comments)
33. Empty block comment `~~ ~~/` and tight `~~~~/`: legality and node shape. (03-comments)

#### Identifier / handle character class
34. Handle character class formally: `[A-Za-z0-9_-]`, first char letter; trailing-hyphen disallowed. (04-nodes-use)
35. Handle case-sensitivity: exact-match vs case-fold. Lean exact. (04-nodes-use)
36. Handle Unicode policy: ASCII-only / NFC-normalised / UAX #31. (04-nodes-use, 07-definitions)
37. Leading-underscore handle (`@_private`): allowed or not. (04-nodes-use)
38. Digit-before-`@` boundary (`agent007@…`): non-NodeUse-opener, parity with letter-before. (16-ambiguity)

#### Parens parameter form (05)
39. Empty `()` form: legal as `Param[] = []` with `ParamSource='parens'` vs equivalent to bare `@x`. (05-nodes-parens)
40. Parens trailing-comma policy (`@x(a,)`): tolerated, no empty slot. (05-nodes-parens)
41. Inner-whitespace normalization inside parens slots — strip per slot, parity with pipes. (05-nodes-parens)
42. Hyphen-as-separator rule (` - ` with surrounding spaces); literal hyphen in identifier. (05-nodes-parens, 06-parameters-pipes)
43. Parens self-closing classification: standalone-line=block, mid-prose=inline (parity with 4.S.2). (05-nodes-parens)
44. Parens-then-body shape (`@aside(...) body aside@`): error vs explicit-closer-overrides. (05-nodes-parens)

#### Pipe parameter form (06)
45. Bare positional vs flag: single-word no-`!` is positional. (06-parameters-pipes)
46. Last-one-wins scope for named pipes: node-scoped; positional appended (no dedup). (06-parameters-pipes)
47. Empty `||` semantics in body vs capture-list opener context — body=error, capture-list=reserved. (06-parameters-pipes)
48. Pipe-shaped text mid-prose: position-sensitive slot recognition (slot only at expected positions). (06-parameters-pipes)
49. Mid-body pipe scatter: parse collects all, resolver applies last-one-wins per key (two-pass). (06-parameters-pipes)
50. Multi-word key delimiter: first-space-or-` - ` rule, single deterministic split. (06-parameters-pipes)

#### Definitions (07)
51. Interpolation `::name::` context-only (inside definition body); literal elsewhere. (07-definitions)
52. Capture-list shape: `||a, b||` legal only in definition opener; body `||` errors. (07-definitions)
53. Empty capture list `||||`: equivalent to no capture list. (07-definitions)
54. Capture-name character class — parity with handle class. (07-definitions)
55. Definition shape decided by opener byte (block / single-line / value-block); shape classifier rule (a). (07-definitions)
56. `!!` terminator trailing-whitespace tolerance and nested-definition LIFO. (07-definitions)
57. Body-slot `...` positioning: at-most-once, anywhere; literal in single-line value. (07-definitions, I.16)
58. Empty single-line value `#name: !!`: legal, value is empty string. (07-definitions)
59. Definition redefinition: error unless `+#x` additive prefix. (07-definitions)
60. Interpolation of undeclared capture: resolve-time error at `::z::` loc. (07-definitions)

#### Additive partials (08)
61. `+#name` merge stage: expand-time merge in resolver (single `NodeDef` after resolution). (08-additive-partials)
62. Merged `NodeDef.loc` policy: first contribution's loc; children carry per-contribution loc. (08-additive-partials)
63. Mix normal `#x` + additive `+#x`: base + additives compose (single base permitted). (08-additive-partials)
64. Shape compatibility across `+#x` contributions: must match across contributions; mismatch errors. (08-additive-partials)
65. `+#name` cross-file scope: shared namespace across reference graph (ratifies I.9). (08-additive-partials)
66. Captures on `+#x`: forbidden on additive contributions; signature owned by non-additive base. (08-additive-partials)
67. Bare `+#x` with no base or sibling: legal single-contribution definition. (08-additive-partials)
68. Whitespace between `+` and `#` (`+ #name`): error; prefix is exactly `+#`. (08-additive-partials)
69. Partial ordering: depth-first reference traversal, source-byte order within file. (08-additive-partials)
70. Reference de-duplication: same file referenced twice loads once. (08-additive-partials, DS-8)

#### Records / collections (09 / 10)
71. Scalar typing rule (a): signed decimal int/float → Number, lowercase `true`/`false` → Bool, else String. (09-records, 10-collections)
72. Boolean literal recognition: lowercase exact `true`/`false` only. (09-records)
73. Number recognition scope: no scientific notation / no hex / no underscores / no `Infinity`/`NaN`. (09-records)
74. Empty record-field value `{ a - }`: parse error. (09-records)
75. Comma-in-unquoted-value: comma always terminates field at brace level (forces quoting/escape for embedded commas). (09-records)
76. Hyphen-separator rule for `key - value` (parity across parens/pipes/braces). (09-records)
77. Nested record value: brace value implies no `-` separator (`a { ... }`). (09-records)
78. Duplicate keys in same record `{ a - 1, a - 2 }`: error or last-one-wins. (09-records)
79. Records-in-params composition: legal, deferred fixture to combinations. (09-records)
80. Whitespace-separated items inside inline `[ ]`: single multi-word String item, not space-separated items. (10-collections)
81. Empty items between commas `[ , ]` / `[ a, , b ]`: error. (10-collections)
82. Newline-as-item-separator inside `[ ... ]` (parity with multi-line records). (10-collections)
83. Mixed structural shapes inside one collection: legal. (10-collections)

#### Data access (11)
84. Fuzzy-key canonical form: lowercase + split on whitespace/underscore/camel boundaries + space-joined. (11-data-access)
85. Spaces inside access path `@keeper.years at post`: single-token segment, words after become prose. (11-data-access)
86. Numeric-vs-named segment disambiguation: parent value-shape decides (collection→index, record→key). (11-data-access)
87. Chained access depth: unbounded; each non-terminal must yield a container. (11-data-access)
88. Container at terminal access position: resolution error (no canonical text form for record/collection). (11-data-access)
89. Acronym fuzzy-match edge (`HTTPSPort`): deferred. (11-data-access)

#### Conditionals (12)
90. `is` vs `equals` operators: exact synonyms for value-equality on scalars. (12-conditionals)
91. Truthy rule for bare-reference `(if @x)`: falsy = `Bool(false)` or missing/absent; `0`, `""`, `{}`, `[]` are truthy. (12-conditionals)
92. Missing-field-in-conditional suppressed-to-falsy (reconciles with I.11/M1-RECONCILIATIONS). (12-conditionals)
93. Empty `(if c) (end)` / `(else) (end)` body: legal no-op, no diagnostic. (12-conditionals)
94. Whitespace inside parens-keywords `( if ... )` vs `(if ...)`: keywords recognised only with tight opener. (12-conditionals)
95. Nested `(if)` classification: single block form, LIFO depth-based `(end)` pairing. (12-conditionals)
96. `(if ...)` positionally free: may open mid-paragraph as well as block-start. (12-conditionals)
97. Comparison strict-typed (no coercion): `Number(99) is String("99")` is type-mismatch error. (12-conditionals)

#### Iteration (13)
98. Loop variable shadowing inside `(each)` body: lexical shadowing wins; outer `#item` shadowed until `(end)`. (13-iteration)
99. Empty `(each ... as item) (end)` body: legal, no output per iteration. (13-iteration)
100. Iteration source-order preservation as a normative property. (13-iteration)
101. Loop variable scope: body-only; name reverts after `(end)`. (13-iteration)
102. Nested-each: lexical stacking of loop variables; inner wins on name collision. (13-iteration)
103. `(end)` LIFO pairing across mixed `(if)` / `(each)` nesting: untyped `(end)`. (13-iteration, 17-combinations)

#### Composition / references (14)
104. Cross-file forward references / global hoisting: affirm I.8 across the reference graph. (14-composition)
105. Path resolution: POSIX-style relative paths, leading `./` or `../`, bare or absolute paths forbidden. (14-composition)
106. Transitive reference visibility: graph fully flattened before expansion. (14-composition)
107. Self-reference handling: no-op via already-visited memoization. (14-composition)
108. Circular reference (length ≥ 2): unroll via memoization (cycles operationally indistinguishable from DAG). (14-composition)
109. Missing referenced file: hard error naming both referencing file and attempted path. (14-composition)
110. `reference` directive position: anywhere at top level (hoisting handles ordering). (14-composition)
111. Reference resolution walk order: depth-first, source order — normative for diagnostics. (14-composition)
112. Duplicate definitions across files: error unless `+#x` additive (parity with single-file redefinition). (14-composition)

#### Scripting (15)
113. Inline `<% expr %>` legal positions: anywhere a prose text run is legal; not inside structural keys/names. (15-scripting)
114. Script run ordering: strict document order, single top-to-bottom pass. (15-scripting)
115. `lh` bridge surface stability: frozen core seven methods; `lh.host.*` namespace for app extensions. (15-scripting)
116. `<% %>` content opacity: opaque bytes terminated by first `%>` outside JS string/template/regex state. (15-scripting)
117. Script errors: propagate as fatal diagnostic (no silent swallow). (15-scripting)
118. `@scriptCall` zero-arg form: empty parens required (`@scriptCall(foo)` is a call, not a ref). (15-scripting)

#### Combinations / cross-cuts (17)
119. Access path inside non-prose contexts (pipe values, conditional RHS, captures): uniform recognition. (17-combinations)
120. Resolution timing: definitions resolve at expansion site; iterated collections snapshot at iteration entry; pipe values evaluate eagerly at use-site. (17-combinations)
121. Emphasis tokenisation inside use-side block-form bodies: full prose grammar applies. (17-combinations)
122. `lh.inject` fragment parsing: injected bytes re-parsed as Wit (not byte-literal). (17-combinations)
123. Definition body re-resolved per expansion (not captured at definition site). (17-combinations)

#### Error model (DS-15 codes — from tests/errors)
124. Error codes enumerated: `E_UNCLOSED_NODE`, `E_MISMATCHED_CLOSE`, `E_UNCLOSED_COMMENT`, `E_UNCLOSED_PAREN`, `E_UNCLOSED_DEFINITION`, `E_EMPTY_PIPE`, `E_UNRESOLVED_REFERENCE`, `E_MISSING_FIELD`, `E_MISSING_REFERENCE_FILE`, `E_CIRCULAR_REFERENCE`, `E_PARTIAL_SHAPE_MISMATCH`, `E_BARE_FIELD`, `E_TYPE_MISMATCH`. (tests/errors)
125. Loc convention: opener-location for unclosed constructs; closer-location for mismatched closers; reference-site for unresolved references; field-name for missing-field. (tests/errors)

#### Integration-level confirmations
126. `(if ::param:: is X)` inside a definition body: deferred-evaluation, resolves at invocation. (integration/report.wit)
127. `@code` and similar nodes do not switch the parser grammar based on a `language` parameter — bodies parse uniformly. (integration/blog-post.wit)
128. `+#name:` accepts the full range of value shapes a `#name:` accepts (single-line, multi-line, record, collection). (integration/book-manuscript)
129. Parameter value runs to the next unescaped `|`; em-dashes, periods, ALL CAPS, parens-in-prose do not terminate. (integration/film-script.wit)
130. Use-side `!!` short-close — surfaced by M1.17 nested-nodes and script-injects fixtures (conflicts with M1.07 lean; see M1-RECONCILIATIONS). (17-combinations, 07-definitions)

---

## J. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Spec ambiguity discovered late | High | M1 fixture pass forces ambiguities to surface before parser is written |
| `!!` greedy parse swallows prose | High | Restrict `!!` to specific contexts; document the rule |
| Bare-reference disambiguation | High | Require non-word boundary after `@name`; document the rule in spec |
| Parser performance under LSP demand | Medium | Profile in M3; consider incremental parsing in M5 |
| TextMate stub disagrees with parser | Low | Keep stub region-only; rely on LSP for tokens |
| Multi-file source maps lose origin | Medium | Locations always include `{ file, line, col }` |
| Versioning churn pre-1.0 | Medium | 0.x with explicit breaking-change notes |
| `<% %>` JS bleeds into Wit | Medium | Lex `<% %>` as opaque; parser doesn't enter JS |

---

## K. Operations

- **Build:** pnpm workspaces, TS strict, ESM only.
- **Test:** vitest, snapshot-based. `pnpm test`; `pnpm test --update` to refresh snapshots.
- **CI:** GitHub Actions on push. `pnpm install` → `pnpm typecheck` → `pnpm test` → `pnpm build`.
- **Versioning:** Changesets. Pre-1.0 = 0.x, breaking allowed. Spec PDF carries its own version that parser targets.
- **Publish:** npm on tag (packages); VSIX for extension; spec PDF in repo + docs site.
- **Docs:** spec PDF (canonical), `examples/` (narrative), `tests/fixtures/` (executable spec).
- **Telemetry:** none.
- **License:** MIT (pending confirmation).

---

## L. File / directory plan (post-M0)

```
prototype_language_wit/
  README.md
  PLAN.md
  LICENSE
  wit-spec.pdf
  cspell.json
  pnpm-workspace.yaml
  package.json            (root)
  examples/               (narrative, one per feature)
  packages/
    parser/
      src/
        lexer.ts
        parser.ts
        ast.ts
        errors.ts
        index.ts
      package.json
      tsconfig.json
    runtime/
      src/
        resolver.ts
        expander.ts
        lh.ts
        index.ts
    render-html/
    vscode/
      package.json
      language-configuration.json
      syntaxes/wit.tmLanguage.json
      server/
      client/
    cli/
  tests/
    fixtures/
      00-lexical/
      01-prose/
      02-emphasis/
      03-comments/
      04-nodes-use/
      05-nodes-parens/
      06-parameters-pipes/
      07-definitions/
      08-additive-partials/
      09-records/
      10-collections/
      11-data-access/
      12-conditionals/
      13-iteration/
      14-composition/
      15-scripting/
      16-ambiguity/
      17-combinations/
    integration/
    errors/
    runner/
      vitest.config.ts
      snapshot.ts
      walk.ts
  .github/
    workflows/ci.yml
```

---

## M. First concrete actions

1. Lock final decisions (license, package name, anything outstanding).
2. **Commit this `PLAN.md`.** ← we are here
3. M0 scaffold: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, empty `packages/parser` with `ast.ts` stub, vitest config, CI workflow. One commit.
4. Begin M1: write fixture `.wit` files. Surface design questions; resolve open questions I.1–I.17.
5. End of M1: every fixture compiles in our heads; spec PDF v0.2; AST types finalized.

---

## N. Planning levels — how they map

```
User stories       describe what someone wants
   ↓
Dev stories        describe what we have to build
   ↓
TDD stories        describe what we test
   - Utility       pure functions, isolated tests, foundation
   - State         AST shapes, invariants, type safety
   - Composition   how units combine into pipelines
```

Tests run bottom-up: utility green first (easy, isolated), state green next (shapes correct), composition green last (pipeline integration). Failures climb the stack: a composition failure points back to a state or utility test that should be added.

---

## O. Living document

This file is the source of truth for *what* and *why*. As open questions resolve, the answers land here. As TDD stories surface mid-implementation, new rows append to G. As risks materialize or recede, J is updated. PRs that change behavior should cross-reference the dev story they implement.
