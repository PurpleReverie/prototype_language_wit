# context-pack — active orchestration artifact (RULES.md rule 6)

The implementer's only mandatory read. Decisions and history live in git
(commit messages, `_notes.md` files merged to main, `tests/M1-REVIEW.md`,
`tests/M1-RECONCILIATIONS.md`, `PLAN.md` section I). The implementer
codes blind to prior decisions and writes for the current task's local
scope. Downstream-conflict checking happens at the **reviewer** stage,
not here.

## 1. How to use this pack

You are an implementer for one Wit task. Read this pack. Skim the
current task brief (section 4). Author the files for your scope.
Self-review against section 3. Commit on a fresh branch. Return ≤ 20
lines per section 5. Don't read PLAN.md or prior `_notes.md` unless
you need a specific spec citation — and even then, just the line(s)
you need.

## 2. Conventions

**General:**
- Files <350 lines (RULES 1). Functions <20 lines with local helpers (RULES 2).
- Filenames kebab-case in fixtures and tests.
- Stay inside your task's scope. Do NOT run `git checkout`, `git restore`,
  `git reset --hard`, or any command that discards changes to files outside
  your task. The main session manages shared files; you never reset them.

**Fixture authoring (M1 categories):**
- Narration `~ ...` inside `.wit` is forbidden from `03-comments/` onward.
  All explanatory text in `_notes.md`.
- One `.wit` file = one purpose. No "and" in fixture filenames.
- Each `_notes.md` H2 cites `PLAN.md I.x` OR `(no PLAN.md entry — new I.review item)`.
- Each open-question H2 has a `**Concrete proposal:**` line committing to
  rule (a) / (b) / (c). It's a lean for review, not a final decision.
- Byte-sensitive fixtures: author via `printf`, verify with `od -c`,
  record the invocation in `_notes.md`.

**Code (M2+ TypeScript):**
- ESM only. `.js` extensions in TS imports (`import { x } from './foo.js'`).
- TS strict mode (already in tsconfig). No `any`. No `// @ts-ignore`.
- One concept per file. AST in `ast.ts`, tokens in `tokens.ts`, lexer in
  `lexer.ts`, parser in `parser.ts`, errors in `errors.ts`.
- Discriminated unions over enums. Tagged objects (`{ kind: 'paragraph', ... }`).
- Source locations on every AST node: `{ file, line, col, length }`.
- Errors typed: `WitError` with `code`, `message`, `loc`.
- Co-locate unit tests as `foo.test.ts` next to `foo.ts`. Vitest, ESM.
- No new runtime `dependencies` in `packages/parser/package.json` (DS-18).
  Dev deps allowed.

**Locked design decisions you need to honor (M2 onward):**
- I.36 handle class is ASCII-only `[A-Za-z0-9_-]` for v1.0.
- I.4 backslash escapes the four reserved chars in param values:
  `\|`, `\,`, `\!`, `\\`. Elsewhere `\` is literal.
- R2/R5 `!!` is definition-only for v1.0. Use-side short-close
  (`@x body !!`) is rejected — `@x(body)` parens-form replaces it.
  M1.04 short-close fixtures will be re-classified during M2.
- See `packages/parser/spec/double-bang-lexer.md` for `!!` state machine.
- See `PLAN.md` section C "Resolution timing" for stage assignment.

## 3. Self-review checklist (run before committing)

**Fixture tasks:**
- [ ] If category ≥ 03: `grep -rE "^~ " <category>/*.wit` returns nothing.
- [ ] All filenames kebab-case, no "and" in any filename.
- [ ] Every `_notes.md` H2 matches the citation form (I.x or new I.review).
- [ ] Each open-question H2 has a `**Concrete proposal:**` line.
- [ ] `_notes.md` under 600 lines; each fixture under 30 lines.

**Code tasks:**
- [ ] All source files under 350 lines; if any nears the cap, split.
- [ ] No function over 20 lines; extract local helpers.
- [ ] All TS imports use `.js` extension.
- [ ] No `any`, no `@ts-ignore`. `pnpm typecheck` exits 0.
- [ ] Co-located `.test.ts` for any non-trivial logic.
- [ ] `packages/parser/package.json` `dependencies` field still absent.
- [ ] `pnpm test`, `pnpm build` exit 0.

## 4. Current task brief

```
TASK: M12.bundle-extension — esbuild bundle so VSIX install actually runs
BRANCH: m12-bundle-extension
COMMIT: M12.bundle-extension: esbuild client + server into self-contained dist files

SCOPE: The VSIX produced by `pnpm vscode:install` installs but the
extension never activates because:
- vsce --no-dependencies skipped bundling node_modules
- Without node_modules, the runtime imports of vscode-languageclient
  / vscode-languageserver / @wit/parser / @wit/runtime fail
- Result: client extension.js loads but its first import throws and
  the LSP server never spawns

Standard VS Code extension fix: bundle each side with esbuild into a
single self-contained file. Keep `vscode` external (provided by host).

CHANGES NEEDED:

1. packages/vscode/package.json devDeps:
   - add `esbuild`

2. packages/vscode/package.json scripts:
   - replace `build: tsc --build` with `build: pnpm run typecheck && pnpm run bundle`
   - add `typecheck: tsc --build --noEmit` (use existing tsconfig refs)
   - add `bundle: pnpm run bundle:client && pnpm run bundle:server`
   - add `bundle:client: esbuild client/extension.ts --bundle --platform=node --target=node20 --external:vscode --format=cjs --outfile=client/dist/extension.js`
   - add `bundle:server: esbuild server/server.ts --bundle --platform=node --target=node20 --external:vscode --format=cjs --outfile=server/dist/server.js`
   - keep `package` and `install:local` working — they call `build` first

3. packages/vscode/package.json — REMOVE `"type": "module"`
   - Why: VS Code extensions have historically been CJS. CJS bundle
     is the most portable. ESM is OK in VS Code 1.94+ but bundler+ESM
     interactions with workspace deps are unnecessary complexity here.

4. packages/vscode/server/tsconfig.json + client/tsconfig.json:
   - emit can stay but bundle replaces it for the actual VSIX. Keep
     tsc for typecheck only (noEmit).
   - OR delete the tsconfigs if redundant — bundle handles emit

5. packages/vscode/.vscodeignore:
   - exclude `client/*.ts`, `server/*.ts`, `**/*.test.ts`, `tsconfig*.json`,
     `*.tsbuildinfo`, `node_modules/`, `.gitignore`, `src/**`
   - INCLUDE `client/dist/extension.js` and `server/dist/server.js`

6. Root pnpm-lock.yaml may need regen after esbuild devDep added.

VERIFICATION:
- After bundling: `cat packages/vscode/client/dist/extension.js | head -5` should show a large bundled file (kb-scale).
- Same for server.js.
- `pnpm vscode:install` succeeds.
- The installed extension dir under ~/.vscode/extensions/ should contain dist files only — no node_modules required.
- Open a `.wit` file in VS Code, check Output panel → "Wit Language Server" channel for startup logs. No "module not found" errors.

EDGE CASES:
- @wit/parser and @wit/runtime are workspace deps. esbuild needs to
  resolve them via the workspace symlinks in repo root node_modules.
  Should work out of the box.
- Sourcemaps: not required for v1; can be added later with --sourcemap.
- Server file size: probably 50-200 KB after bundling. Acceptable.

HARD RULES:
- No git checkout/restore/reset outside `packages/vscode/`
- Files <350 lines (the bundled output is an artifact, doesn't count)
- esbuild added as devDep is fine; no new RUNTIME deps in any other package.

PROCEDURE:
1. git checkout -b m12-bundle-extension
2. Add esbuild devDep; pnpm install
3. Update package.json scripts + remove "type": "module"
4. Update .vscodeignore
5. Run `pnpm --filter wit-vscode build` — verify bundled outputs exist
6. Run `pnpm --filter wit-vscode package` — verify VSIX has bundled files
7. Optionally manually test: code --uninstall-extension wit.wit-vscode; pnpm vscode:install; open a .wit file
8. pnpm typecheck/test/build all exit 0 at repo root
9. Single commit. No push, no merge.

Return ≤ 20 lines per section 5.
```

SCOPE: Bring the VS Code extension from "parse-only LSP" to a real
IntelliSense experience. Four LSP capabilities + one foundational
piece (resolver-in-server) + cross-file reference following.

────────────────────────────────────────────────────────────────────
PART A — Resolver-in-server cache + position index
────────────────────────────────────────────────────────────────────

Today: packages/vscode/server/server.ts runs `parse()` on each change
and emits diagnostics from parse errors + semantic tokens. The
resolver is never invoked.

Add a per-document cache keyed by document URI:

```ts
type DocumentState = {
  uri: string;
  source: string;
  parsed: Document | null;
  resolved: ResolvedDocument | null;
  parseErrors: WitError[];
  resolveErrors: WitError[];
  // Position index: which AST node is at a given (line, col)?
  // Sorted by source span; binary-searchable.
  positionIndex: PositionEntry[];
};

type PositionEntry = {
  startLine: number; startCol: number;
  endLine: number;   endCol: number;
  kind: 'nodeUse' | 'nodeDef' | 'interpolation' | 'accessSegment' | ...;
  node: ASTNode; // pointer to the AST node
};
```

On `didOpen` / `didChange`:
1. Parse → cache + emit parse-error diagnostics
2. If parse succeeded: resolve → cache + emit resolve-error diagnostics
   (E_UNRESOLVED_REFERENCE, E_MISSING_FIELD, etc. as squiggles too)
3. Build position index from the resolved AST

Cross-file (PART E below) lives here too: when resolving, follow
`reference ./path.wit` directives via fs.readFile, cache referenced
files' parses too.

────────────────────────────────────────────────────────────────────
PART B — Hover (textDocument/hover)
────────────────────────────────────────────────────────────────────

Capability flag in initialize response: `hoverProvider: true`.

Handler:
1. Resolve `{uri, line, col}` → AST node via position index
2. If NodeUse: format hover content as markdown:
   ```
   `@chapter` (NodeUse)

   Defined in: <file>:<line>
   Captures: [number, title, subtitle]

   Body:
       ::number:: — ::title::
       ::subtitle::
   ```
3. If NodeDef: format as "definition of `#chapter`" + signature
4. If Interpolation `::name::`: show "captures `name` from enclosing
   def"
5. If access segment (`.field`): show "field of DataDef `x`" if
   resolvable, else "unresolved"
6. If core-vocab name: show "core vocabulary: maps to HTML `<h1>`,
   Markdown `#`, etc."
7. If `@node`: show "opaque renderer pass-through. params travel
   to renderer."

Return `null` for other positions (no popup).

────────────────────────────────────────────────────────────────────
PART C — Go-to-definition (textDocument/definition)
────────────────────────────────────────────────────────────────────

Capability flag: `definitionProvider: true`.

Handler:
1. Resolve position → AST node
2. If NodeUse with binding: return `Location` { uri, range } of the
   binding's NodeDef. Cross-file URIs work too once Part E is wired.
3. If access segment of a DataDef: return DataDef's loc
4. If Interpolation: return capture declaration loc (the `||...||`
   slot or the captured `::name::` first occurrence)
5. Otherwise: return null (no jump)

Use LSP `Location[]` (return an array; usually length 1, but
references-to-additive-partials might return multiple).

────────────────────────────────────────────────────────────────────
PART D — References (textDocument/references) + Document Symbols
────────────────────────────────────────────────────────────────────

Capability flags: `referencesProvider: true`, `documentSymbolProvider: true`.

References handler:
1. Resolve position → AST node
2. If NodeDef: walk all NodeUses across the resolved scope (current
   doc + cross-file referenced docs) where `node.binding === thisDef`
3. Return `Location[]` of those NodeUse loc spans

Document symbols handler:
1. Walk resolved AST for all NodeDef + DataDef
2. Return `DocumentSymbol[]` with name, kind (Function for NodeDef,
   Variable for DataDef), range, selectionRange
3. Enables Cmd-Shift-O outline navigation in VS Code

────────────────────────────────────────────────────────────────────
PART E — Completion (textDocument/completion)
────────────────────────────────────────────────────────────────────

Capability flag: `completionProvider: { triggerCharacters: ['@', '#', ':'] }`.

Handler — determine context from cursor position:

CASE 1: cursor immediately after `@` (NodeUse name being typed)
  Offer:
  - All 47 core vocabulary names (always — they need no def)
  - All NodeDef and DataDef names from the resolved doc + cross-file
  - Differentiate by `kind`:
    - core-vocab → CompletionItemKind.Keyword
    - NodeDef → CompletionItemKind.Function
    - DataDef → CompletionItemKind.Variable
    - special: `node` → CompletionItemKind.Module
  - Detail field: brief description (e.g., "core: heading level 1",
    "def: cite (5 captures)", "data: keeper")
  - Documentation: first 2-3 lines of def body / first record field

CASE 2: cursor immediately after `#` (NodeDef name being typed at
  block-level)
  Offer template scaffolds:
  - `<name>` — basic empty NodeDef
  - `<name> ||a, b||` — NodeDef with captures
  - `<name>: value !!` — single-line def
  - Plus existing NodeDef names (for redefinition / merge)

CASE 3: cursor immediately after `::` in a NodeDef body
  Offer the captures available in the enclosing NodeDef
  (explicit captures from `||...||` OR inferred from prior
  interpolations in the body)

CASE 4: cursor inside a NodeUse's params (after `|` or `(`)
  If the NodeUse has a binding, offer the def's capture names as
  named-param keys

CASE 5: cursor on an access path (after `@x.`)
  If `@x` binds to a DataDef with a Record value, offer the record's
  field names

Return a `CompletionList`. Don't be exhaustive in v1 — focus on
the cases that bite during real authoring.

────────────────────────────────────────────────────────────────────
PART F — Cross-file reference following
────────────────────────────────────────────────────────────────────

Today: resolver in @wit/runtime already supports cross-file via the
`fileReader` option (M4.cross-file). The LSP server just hasn't
wired it.

Add to the server:
- Default fileReader = node fs.readFileSync (sync is fine for now)
- Workspace-root detection from initialize params
- When resolving a document with `reference ./...`: follow + parse +
  resolve each referenced file, populate the cache for those URIs
  too
- On `didChange` of file A: invalidate all files that reference A
  (transitively). Re-resolve dependents.
- A simple inverted index `Map<referenced_uri, dependent_uris[]>`
  handles invalidation

────────────────────────────────────────────────────────────────────
FILES TO CREATE / EDIT
────────────────────────────────────────────────────────────────────

- packages/vscode/server/server.ts — register new capabilities,
  wire handlers
- packages/vscode/server/document-cache.ts (NEW) — per-URI state
- packages/vscode/server/position-index.ts (NEW) — build + query
- packages/vscode/server/hover.ts (NEW)
- packages/vscode/server/definition.ts (NEW)
- packages/vscode/server/references.ts (NEW)
- packages/vscode/server/document-symbols.ts (NEW)
- packages/vscode/server/completion.ts (NEW)
- packages/vscode/server/cross-file.ts (NEW) — workspace fs reader +
  dependent invalidation
- packages/vscode/server/diagnostics.ts — extend to emit resolver
  errors in addition to parse errors

Each handler file under 200 lines; functions under 20.

────────────────────────────────────────────────────────────────────
TESTS
────────────────────────────────────────────────────────────────────

Add pure-function unit tests for each handler (don't need a real
LSP runtime):
- position-index.test.ts — index build + lookup correctness
- hover.test.ts — given a resolved doc + position, returns expected
  markdown content
- definition.test.ts — returns expected Location
- references.test.ts — finds all uses of a def
- completion.test.ts — context-aware suggestions per case 1-5
- cross-file.test.ts — virtual fs, references following, invalidation

Aim for ~30-40 new tests. Keep existing 630 tests green.

────────────────────────────────────────────────────────────────────
HARD RULES
────────────────────────────────────────────────────────────────────

- No git checkout/restore/reset outside `packages/vscode/`
- Files <350 lines, functions <20 lines, ESM `.js`, TS strict, no any
- Add devDeps as needed for any vscode-language* peers — no new
  runtime deps in packages/parser, runtime, render-*

────────────────────────────────────────────────────────────────────
PROCEDURE
────────────────────────────────────────────────────────────────────

1. git checkout -b m11-lsp-intellisense
2. Part A first (resolver-in-server foundation)
3. Part F (cross-file) — gets out of the way before handlers
4. Parts B + C + D (hover, def, references, doc-symbols)
5. Part E (completion) — context-detection is the trickiest
6. pnpm build to produce dist/ for client + server
7. pnpm typecheck/test/build exit 0
8. Single commit on the branch

Time budget: substantial. Aim for ~90 min. Document any gaps in
the return summary rather than getting stuck.
```

SCOPE: Substantial design + implementation milestone. Five tightly
coupled threads on one branch.

────────────────────────────────────────────────────────────────────
THREAD 1 — Optional ||captures||
────────────────────────────────────────────────────────────────────

`#name ||a, b, c|| body name#` capture lists become OPTIONAL.

- When the capture list is present: it's an explicit contract.
  Parser validates that every `::name::` interpolation in the body
  has a matching capture name (warning, not error). At use site, all
  capture names are bindable from positional or named params.
- When the capture list is absent: scan the def body for `::name::`
  interpolations, collect those names into a synthetic capture list,
  store on the NodeDef AST node. Use site behaviour unchanged.

PARSER WORK:
- packages/parser/src/parser-defs.ts — gather captures from body
  when `||...||` not present
- Regression tests for both forms

EXISTING FIXTURES: Most use `||a, b, c||`. They keep working. Optional
new fixtures showing the captures-omitted form.

────────────────────────────────────────────────────────────────────
THREAD 2 — `@node` reserved as universal opaque container
────────────────────────────────────────────────────────────────────

`@node` is a reserved name. The resolver does NOT require a `#def`
named `node`. The expander passes `@node` invocations through
INTACT (don't try to inline, don't error). All params travel with
the AST node into the renderer.

USAGE PATTERNS:
- Self-closing: `@node(type img, src ./lamp.png, alt The keeper's lamp)`
- With body: `@node(type figure) ... caption ... node@`
- Pipe params: `@node |type interactive-quiz| |id q1| ... node@`

THE `type` PARAM CONVENTION: renderers we ship dispatch on `type` to
decide what to do. Other renderers may dispatch on whatever they want;
`type` is not reserved BY the parser, just by convention.

USER-DEFINED WRAPPERS PATTERN (encourage in docs):
```
#highlight ||content||
@node(type highlight) ::content:: node@
highlight#

@highlight Some text highlight@
```

The writer gets a natural `@highlight` name; the AST carries
`@node(type highlight)` which the renderer can handle uniformly.
The wrapper isolates the renderer-specific name from the prose.

RESOLVER WORK:
- packages/runtime/src/resolver.ts — when binding NodeUse:
  - If name is `node` → skip binding lookup, no error
  - If name is in core vocabulary (thread 3) → skip binding lookup
  - Otherwise: existing logic (look up in defs, error if missing)

────────────────────────────────────────────────────────────────────
THREAD 3 — HTML-derived core vocabulary
────────────────────────────────────────────────────────────────────

A reserved set of node names that renderers commit to handling.
Mirrored on HTML's semantic vocabulary. No `#def` needed in source.

THE CORE VOCABULARY (final list — these are the v1 reserved names):

  HEADINGS    h1, h2, h3, h4, h5, h6
  INLINE      em, strong, code, u, s, sub, sup, mark, small, br
  LISTS       ul, ol, li, dl, dt, dd
  LINK+MEDIA  a (href, target), img (src, alt, width, height),
              figure, figcaption, audio, video
  TABLES      table, thead, tbody, tfoot, tr, th, td, caption
  BLOCKS      p, blockquote, pre, hr
  SECTIONING  section, article, aside, header, footer, nav, main
  OTHER       cite (inline citation source)

These names are reserved at the resolver level (no `#def` required).
Renderers commit to mapping them.

EXPECTED PARAMS PER NODE (renderers should look at these):
- `@a` |href URL| (required), |target VAL|
- `@img` |src PATH| (required), |alt TEXT|, |width N|, |height N|
- `@audio` / `@video` |src PATH|, |controls!|
- `@figure` block with `@figcaption` child
- `@table` |schema [...]| or |rows [...]| (see thread 4)
- everything else has no required params — they're structural containers

RENDERER WORK:
- packages/render-html/src/render.ts — explicit handlers for every
  core name; map to corresponding HTML element with attrs from params
- packages/render-markdown/src/render.ts — explicit handlers:
  - h1-h6 → `#`-prefix lines
  - ul/ol/li → `-`/`1.` lists
  - a → `[text](url)`
  - img → `![alt](src)`
  - blockquote → `> ` lines
  - code (inline) → backtick-wrap
  - pre → fenced code block
  - hr → `---`
  - br → trailing two-spaces or `<br>`
  - dl/dt/dd → bold label + paragraph
  - table → see thread 4
  - section/article/etc → just emit content (no MD wrap)

────────────────────────────────────────────────────────────────────
THREAD 4 — @table (CSV-style + schema)
────────────────────────────────────────────────────────────────────

`@table` is a core-vocab node with sophisticated row/schema handling.

AUTHORING FORM 1 — Inline CSV-style:
```
@table |rows [
  [Client Hours,  COUN603, COUN704, TOTAL ],
  [One to One,    62.75,   41.25,   104   ],
  [Couple,        0.75,    0,       0.75  ]
]|
```

- First row of `rows` is the header by convention.
- Override with `|header [Foo, Bar]|`, `|header false|` (no header),
  or `|header N|` (use row N — defaults to 0).

AUTHORING FORM 2 — Records with schema:
```
#sites: [
  { name - Dunmore Head, status - operational }
  { name - Carrick Point, status - maintenance }
]

@table |schema [name, status]| |rows @sites|
```

- Schema as array of keys: positional, header labels default to key
  names. Override headers with `|header [Site, Status]|`.

AUTHORING FORM 3 — Records with labelled schema:
```
@table
  |schema { name - Site, status - Status }|
  |rows @sites|
```

- Schema as record: keys are field names in row records, values are
  display headers.

CELLS CAN CONTAIN INLINE CONTENT:
- `[*Total*, 63.5, 41.25, 104]` — bold first cell
- Multi-line cells via `!...!` inside the array element (extension to
  Collection element parser — see thread 5)

`caption` PARAM: `|caption Practicum Hours|` adds `<caption>` in HTML,
heading line in Markdown.

NUMBER ALIGNMENT: don't emit `text-align`. Themes/CSS handle.

RENDERER OUTPUT:
- HTML: full `<table>` `<thead>` `<tbody>` `<tr>` `<th>` `<td>` `<caption>` tree
- Markdown: pipe-table with `---` separator after header. Multi-line
  cell content collapses internal newlines to spaces in v1; if cell
  needs paragraphs the author should reach for `@dl`.

────────────────────────────────────────────────────────────────────
THREAD 5 — `!...!` value blocks inside Collection elements
────────────────────────────────────────────────────────────────────

Currently `!...!` value-block syntax works in `#name:` definition
values. Extend it to also work as a Collection element:

```
[ Article 1: Kāwanatanga,
  ! The practice of good governance.
    Co-governance, partnership, collaboration.
    My commitment: positive reframing and offering
    mana-enhancing feedback. !,
  next-cell-value
]
```

Inside `!...!`:
- Commas don't terminate the cell (they're content)
- Newlines don't terminate the cell (they're content)
- Closing `!` ends the cell

PARSER WORK:
- packages/parser/src/lexer-data.ts (or wherever Collection parsing
  lives) — recognize `!` opener within Collection element, scan to
  closing `!`, emit as a single Cell value with multi-line text.
- parser-data.ts handles the cell content appropriately (could be
  Inline content, not just raw text).

────────────────────────────────────────────────────────────────────
THREAD 6 — PLAN + docs updates
────────────────────────────────────────────────────────────────────

PLAN section A non-goals: REMOVE the line "Not a renderer-defining
language. Wit produces a tree; the renderer decides HTML/CSS/visual
form." (still partly true but misleading.) REPLACE with:

> Wit reserves a small core vocabulary mirroring HTML's semantic
> shapes (headings, lists, links, images, tables, sections, etc.).
> Renderers commit to handling these faithfully. Beyond the core,
> writers define their own vocabulary with `#name`. For
> renderer-specific extensions (custom React components, mapboxes,
> game-state widgets), `@node(...)` is the opaque pass-through that
> carries params straight to the renderer.

Add a new PLAN subsection under section C: **"Core vocabulary"**
listing the reserved names and their HTML mappings.

Update `examples/` if any existing files would benefit from the new
patterns (don't churn them needlessly).

Update `tests/fixtures/README.md` to mention the new categories.

────────────────────────────────────────────────────────────────────
THREAD 7 — Fixtures
────────────────────────────────────────────────────────────────────

NEW FIXTURE CATEGORIES:
- tests/fixtures/18-core-vocab/ — one fixture per core node group:
  headings, inline marks, lists, links, media, sections, etc.
  Each fixture exercises the core names; renderer snapshots verify
  the right HTML/Markdown comes out.
- tests/fixtures/19-tables/ — three fixtures matching the three
  authoring forms (inline-csv, schema-array, schema-record). Plus
  edge cases: empty table, no header, caption.
- tests/fixtures/20-opaque-node/ — fixtures for `@node`:
  - bare-node-passthrough (just `@node(type something)`)
  - node-with-body
  - user-defined-wrapper (`#highlight` wrapping `@node`)
- tests/fixtures/21-optional-captures/ — fixtures showing both
  forms (with `||...||` and without).

Update snapshot harness if any new collation needed.

────────────────────────────────────────────────────────────────────
PROCEDURE
────────────────────────────────────────────────────────────────────

1. git checkout -b m10-core-vocab
2. Implement in order: thread 1 → thread 2 → thread 3 → thread 5 →
   thread 4 → thread 6 (PLAN) → thread 7 (fixtures).
3. Regenerate snapshots with WIT_SNAPSHOT_UPDATE=1.
4. pnpm typecheck/test/build exit 0.
5. Verify the thesis and portfolio examples still render (or update
   them to use the new core vocab if they benefit).
6. Single commit on the branch (or as many commits as keep history
   clean — your call, but one is fine).
7. Do NOT push, do NOT merge.

HARD RULES:
- No git checkout/restore/reset on files outside the working tree
- Files <350 lines, functions <20 lines, ESM `.js`, TS strict, no any
- No new runtime `dependencies` in any package.json

Return ≤ 25 lines per section 5 (extended for milestone scope):
- Branch + SHA
- Summary line
- Counts: new fixtures, new tests, snapshots updated
- One-line per major work item
- New I.review items
- Self-review pass/fail
- Deviations from briefing
```

SCOPE: Take the prose source in `scratch/portfolio-source.md` and
turn it into a multi-file Wit project under `scratch/portfolio/`.
Then run the CLI to produce HTML and Markdown outputs (`thesis.html`
and `thesis.md` are taken — name these `portfolio.html` and
`portfolio.md`).

NOTHING in `scratch/` is git-tracked. Do NOT branch, do NOT commit,
do NOT push. Just write files in `scratch/portfolio/` and run the
CLI.

SOURCE: `scratch/portfolio-source.md` (already created). It has
eight sections corresponding to the document's logical structure.
Read it once and use it as your authoring guide.

SUGGESTED LAYOUT:

```
scratch/portfolio/
  master.wit                      ← top-level composition
  shared/
    schema.wit                    ← templates: #section, #subsection,
                                    #form_field, #table_row, #cite,
                                    #reference_entry, etc.
    sources.wit                   ← all the references as #boud, #bradley,
                                    #durie98, #durie01, etc.
    metadata.wit                  ← #portfolio: { student, id, count, status }
  parts/
    01-cover.wit                  ← Cover + Academic Integrity Declaration
    02-practicum-hours.wit        ← Hours table (use records / collections)
    03-supervision-report.wit     ← The form + 7 comment blocks
    04-te-tiriti-table.wit        ← The 4-article Te Tiriti table
    05-te-tiriti-commitments.wit  ← Commitments essay (3 subsections)
    06-supervision-domains.wit    ← Formative/Normative/Restorative/
                                    Critical Integration essay
    07-group-reflexivity.wit      ← Group reflexivity essay
    08-references.wit             ← Reference list
  portfolio.html                  ← rendered HTML output
  portfolio.md                    ← rendered Markdown output
  README.md                       ← brief — what this is + how to rebuild
```

FEATURES TO EXERCISE:

- Cross-file `reference ./shared/*.wit` from master, then `reference
  ./parts/*.wit` to pull each part in.
- Templates with captures for repeated patterns (form fields,
  references, section headers).
- Hours table as a `#hours: { ... } !!` record with `(each)` for
  rendering — or accept this is hard and use plain prose rows.
- Conditional draft watermark using the `(if @portfolio.status is
  draft)` pattern.
- Inline `<% lh.prose().wordCount() %>` — the source claims 1634
  words; the actual rendered count won't match perfectly because
  we lose some content (headers, table cell labels) — that's fine.
- At least a few `+#bibliography` additive contributions from
  different parts to the reference list (or just use a single
  references.wit — your call).
- Use the `_italic_` and `*bold*` marks for emphasis where the
  source has bold formatting (e.g., "Academic Integrity Declaration"
  is bold; "Comment on student's use of supervision" is bold).
- Use `~ ` line comments to note any places where the source's
  fidelity was reduced (handwritten content, image references, etc.).

KNOWN GOTCHAS FROM THE THESIS STRESS TEST (avoid these or work
around them):
- Use `@h1 ... h1@` / `@h2 ... h2@` for headings instead of
  literal `#` Markdown syntax inside templates (the HTML renderer
  doesn't know `#` is meant to be a heading).
- Multi-line `#name: { ... } !!` doesn't reach DataDef classification;
  use single-line records for data definitions you want to access
  via `@x.field`.
- Use `@chapter_N` style block defs for parts; compose in master
  with `@chapter_N chapter_N@`, not `@chapter_N(...)`.
- `_text._` (period inside the closing emphasis) won't render as
  italic — keep punctuation outside emphasis.

OUTPUT:

After authoring, build outputs:
1. `node packages/cli/dist/bin.js check scratch/portfolio/master.wit`
2. `node packages/cli/dist/bin.js build scratch/portfolio/master.wit -o scratch/portfolio/portfolio.html`
3. `node packages/cli/dist/bin.js build scratch/portfolio/master.wit -o scratch/portfolio/portfolio.md`
4. Spot-check both outputs visually (cat / head). Note any rendering
   issues in the README.md.

If the document fails to compile at any step, iterate to fix or
document the gap in the README and move on. The goal is to surface
real-world feature gaps, not to perfectly mirror the PDF.

GATES:
- Existing 582+ tests still pass (`pnpm test`).
- portfolio.html and portfolio.md exist and are non-empty.
- README in scratch/portfolio/ documents what works and what
  required workarounds.

NO COMMIT. NO BRANCH. NO PUSH.

PROCEDURE:
1. Read scratch/portfolio-source.md.
2. Create the directory structure under scratch/portfolio/.
3. Author Wit files.
4. Run the CLI to produce outputs.
5. Document in scratch/portfolio/README.md.
6. Return summary (no SHA — nothing is committed).
```

SCOPE: A single, substantial end-to-end stress test that exercises
every Wit feature in concert. Three deliverables on one branch:

────────────────────────────────────────────────────────────────────
PART A — packages/render-markdown/ (new workspace)
────────────────────────────────────────────────────────────────────

Mirror packages/render-html/ structure:
- package.json (name @wit/render-markdown, devDeps only, workspace
  deps on @wit/parser + @wit/runtime, NO runtime dependencies)
- tsconfig.json (extends root)
- src/index.ts — re-export
- src/render.ts — `renderMarkdown(doc: ExpandedDocument): string`
- src/render.test.ts — tests covering each AST kind

AST-to-Markdown mapping:
- Document → joined Block output with single blank line between
- Paragraph → text content + `\n\n`
- Text → escape Markdown specials only at risky positions
  (leading `>`, `-`, `*`, `1.` at line start escape with `\`; mid-line
  `*` `_` ok if not surrounded by word boundaries — for safety, you
  can be lazy and not escape since the parser already normalized)
- Italic → `*content*`
- Bold → `**content**`
- Comment → omitted (no analog in Markdown without HTML)
- NodeUse with conventional name:
  - h1 → `# content\n\n`
  - h2 → `## content\n\n`
  - h3..h6 → `###`..`######`
  - chapter → `# ` (chapters render as h1)
  - section → `## `
  - subsection → `### `
  - figure (block) → `![caption](src)\n\n` where src and caption come
    from params, default empty
  - callout, aside, pullquote → blockquote `> content\n\n`
  - bibliography → emit each child item as `- ` list element
  - For unknown NodeUse kinds → emit content with no decoration
    (Markdown has no opaque container)
- NodeUse with access path (already substituted by expander as Text):
  passes through as Text
- Block ScriptBlock → omitted (already evaluated)
- Inline content concatenates without trailing newline; block content
  joins with double newline

Functions ≤ 20 lines. Split into render.ts + render-inline.ts +
render-block.ts if size demands.

────────────────────────────────────────────────────────────────────
PART B — CLI format detection
────────────────────────────────────────────────────────────────────

Update packages/cli/src/cmd-build.ts:
- If `-o <path>` is given, infer format from extension:
  - `.html`, `.htm` → HTML (current default)
  - `.md`, `.markdown` → Markdown
  - other → error E_UNKNOWN_OUTPUT_FORMAT with helpful message
- Add `--format <html|md>` flag for explicit override
- If no `-o`, default to HTML on stdout (unchanged)
- Add @wit/render-markdown as a workspace devDep on packages/cli

Update packages/cli/src/bin.ts --help text to mention markdown.

Tests: extend cmd-build.test.ts:
- `.html` output uses HTML renderer
- `.md` output uses Markdown renderer
- unknown extension → exits 1 with helpful error
- `--format md` overrides extension inference

────────────────────────────────────────────────────────────────────
PART C — examples/thesis/ mock project
────────────────────────────────────────────────────────────────────

Author a small but realistic philosophy thesis. Topic: "Attention as
a Moral Practice" — builds on Simone Weil / John Berger / Hannah
Arendt references already used in the existing corpus.

Layout:
  examples/thesis/
    README.md              ← Brief explanation of the demo + commands to run
    master.wit             ← Top-level: imports + thesis metadata + body
    shared/
      schema.wit           ← #chapter, #section, #cite, #theorem templates
      sources.wit          ← #weil, #berger, #arendt + argument map (named ideas)
    chapters/
      00-frontmatter.wit   ← Abstract + acknowledgements
      01-introduction.wit
      02-attention-and-labour.wit
      03-the-asymmetry-of-looking.wit
      04-conclusion.wit
    thesis.html            ← Committed rendered output (HTML)
    thesis.md              ← Committed rendered output (Markdown)

Requirements per chapter (across the corpus, distribute liberally):
- Multiple `reference ./...` lines
- At least one additive `+#bibliography` contribution per chapter
- Use of templates with captures: `@chapter |number 1| |title Introduction| chapter@`
- Use of citations: `@weil_attention` argued ...
- At least one `(if @thesis.status is draft)` for a draft watermark
- At least one `(each @bibliography as entry) ... (end)` rendering the
  merged bibliography
- At least one inline `<% lh.prose().wordCount() %>` showing the
  computed word count
- Realistic prose: 100-300 words per chapter
- Comments where useful

KEEP IT MODEST: total source under ~2000 lines. The point is to
exercise feature composition, not write an actual thesis.

────────────────────────────────────────────────────────────────────
PART D — render + verify
────────────────────────────────────────────────────────────────────

After building both renderers and authoring the thesis:
1. Build everything: `pnpm build`
2. `node packages/cli/dist/bin.js build examples/thesis/master.wit -o examples/thesis/thesis.html`
3. `node packages/cli/dist/bin.js build examples/thesis/master.wit -o examples/thesis/thesis.md`
4. Commit both outputs (they're examples-tree artifacts, NOT
   dist-tree, so .gitignore doesn't exclude them).
5. Sanity-check both files visually — the HTML should be valid;
   the Markdown should be readable.

If the thesis fails to fully expand (e.g., unresolved refs, missing
data), iterate either the schema or the chapters until both outputs
exist as valid artifacts. If something can't be made to work, fall
back to a smaller scope and document the gap in
examples/thesis/README.md.

────────────────────────────────────────────────────────────────────
GATES
────────────────────────────────────────────────────────────────────

- pnpm install / typecheck / test / build all exit 0
- New tests for Markdown renderer (~10-15) pass
- CLI tests pass with new format options
- examples/thesis/thesis.html exists, opens as valid HTML
- examples/thesis/thesis.md exists, renders as readable Markdown
- All other 550 pre-existing tests still pass

HARD RULES:
- No git checkout/restore/reset outside the working tree.
- Files <350 lines. Functions <20 lines.
- ESM, TS strict, no any, no @ts-ignore.
- packages/parser, packages/runtime, packages/render-html
  package.json all keep dependencies field absent.
- packages/render-markdown likewise (devDeps only).

PROCEDURE:
1. git checkout -b m8-thesis-stress-test
2. Build render-markdown package + tests.
3. Extend CLI for format detection.
4. Author thesis corpus.
5. Build the outputs; commit them.
6. Single commit. Do NOT push, do NOT merge.
```

SCOPE: Big structural fix. Currently `#x: { a - 1 }` parses as a
NodeDef whose body is a Record literal. That makes `lh.data.x` empty
and `@x.a` access fail to resolve. After this task:

1. Parser detects when a `#name:` single-line def's value is EXCLUSIVELY
   a Record or Collection literal (no other content). When that's the
   case, emit a DataDef AST node instead of a NodeDef.
2. Resolver collects DataDef nodes into `resolver.dataDefs` (it already
   has the map; it's just always empty today).
3. Expander's access-path resolution looks in dataDefs first when
   resolving `@x.field`-style references.
4. lh.data exposes those dataDefs as a plain JS object proxy.

DETECTION RULE (parser-defs.ts):
- During single-line def value capture, if the trimmed value starts
  with `{` and the matching `}` ends the value (or starts with `[` and
  the matching `]` ends), parse the value as a DataValue and emit a
  DataDef.
- If the value contains other content (text mixed with the literal),
  keep it as NodeDef with body containing the Record/Collection AST.
  E.g. `#cite: ::author:: (::year::) !!` stays NodeDef.

ALSO INCLUDE: the small emphasis-close-newline whitespace bug —
`<em>x</em>\nword` should render as `<em>x</em> word` not
`<em>x</em>word`. Same root cause as the @-ref / <% %> case, just
applied to EmphasisClose.

REPRODUCER (do not commit):
```
#paper: { word target - 5000, status - draft } !!

The target is @paper.word_target words.
The status is @paper.status.

<% lh.set('paper.word count', lh.prose().wordCount()) %>

Count so far: @paper.word_count words.

A note in _italic_
should preserve the space.
```

Expected after fix:
- "The target is 5000 words."
- "The status is draft."
- "Count so far: <N> words."
- "A note in <em>italic</em> should preserve the space."

FILES TO EDIT (likely):
- packages/parser/src/parser-defs.ts (DataDef classification)
- packages/runtime/src/resolver.ts (DataDef collection / access)
- packages/runtime/src/expander-conditions.ts (resolveAccessPath)
- packages/runtime/src/lh-bridge.ts (lh.data over dataDefs)
- packages/parser/src/lexer-nodes.ts or similar (emphasis-close newline)
- Snapshot regen via WIT_SNAPSHOT_UPDATE=1

REGRESSION TESTS:
- parser-defs.test.ts: `#x: { a - 1 } !!` → DataDef, not NodeDef.
- parser-defs.test.ts: `#x: text !!` and `#x: ::y:: (text) !!` still
  NodeDef (not all-record-value).
- expander.test.ts or lh-bridge.test.ts: `lh.data.x.a === '1'` for a
  DataDef-classified record.
- expander.test.ts: `@x.field` resolves through dataDefs.
- New emphasis-newline regression in lexer or expander tests.

OUT OF SCOPE: collection iteration over a DataDef-classified
collection (probably already works once dataDefs is populated, but
don't expand scope to fix if it doesn't).

PROCEDURE:
1. git checkout -b m7-datadef-classify
2. Detect + reclassify in parser.
3. Wire resolver + expander to use dataDefs.
4. Fix emphasis-newline polish.
5. Regenerate snapshots with WIT_SNAPSHOT_UPDATE=1.
6. pnpm typecheck/test/build exit 0.
7. Single commit.
```

## 5. Return format contract

Implementer returns exactly this block, ≤ 20 lines:

```
Branch: <name>
SHA: <first 7>
Summary: <one line>
New I.review items: <bullet list, or "none">
Self-review: <pass | needs review of X>
Deviations from briefing: <bullet list, or "none">
```

NO source code, NO type-definition dumps, NO full diffs.

## Notes for the main session

- Update section 4 (current task brief) before each implementer dispatch.
- Decisions are NOT tracked here. They live in git history and
  `tests/M1-REVIEW.md` / `M1-RECONCILIATIONS.md` / `PLAN.md` section I.
- Downstream-conflict checks happen at the periodic reviewer stage
  (every 3–4 merged tasks).
- If this file drifts past 250 lines, compact section 4 or trim
  redundant convention bullets.
