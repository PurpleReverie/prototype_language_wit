# Wit

[![CI](https://github.com/PurpleReverie/prototype_language_wit/actions/workflows/ci.yml/badge.svg)](https://github.com/PurpleReverie/prototype_language_wit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

Wit is a prose-first markup language for people who write — and the
systems that consume what they write. Documents read like normal text;
structure (nodes, data, conditionals, iteration, scripting) layers in
only where the author needs it.

## Why Wit?

Markdown is great for prose but breaks the moment you need structure:
captioned figures, cross-referenced citations, conditional sections,
loops over data. The usual answer is "drop into HTML" or "use a static
site generator with frontmatter" — both shred the prose flow.

Wit keeps prose readable while making structure first-class. Plain
sentences stay plain. When you need a heading, a citation that resolves
itself, a table built from a data record, or a bibliography that
gathers contributions from every file in your project, the syntax
appears only where it's needed.

The reference implementation ships as five small TypeScript packages
(parser, runtime, two renderers, a CLI) plus a VS Code language
extension. Zero runtime dependencies.

## A taste

```
~ A short Wit document.

@h1 Why I like lighthouses h1@

Lighthouses signal *safety* across the _darkest_ nights.

@reference_entry
  author: Weil, S.
  year: 1947
  title: Gravity and Grace
  publisher: Routledge
reference_entry@
```

…compiles to clean HTML or Markdown via the same source. See
[`examples/`](./examples/) for a guided tour and
[`tests/integration/feature-tour.wit`](./tests/integration/feature-tour.wit)
for one file exercising every AST kind.

## Quick start

Install from npm:

```
npm install -g @witlang/cli
wit tour path/to/file.wit
wit check path/to/file.wit
wit build path/to/file.wit -o out.html
```

Or, from a clone of this repo:

```
pnpm install
pnpm build
node packages/cli/dist/bin.js parse path/to/file.wit
node packages/cli/dist/bin.js check path/to/file.wit
node packages/cli/dist/bin.js build path/to/file.wit -o out.html
```

The `wit` binary takes a single subcommand (`parse`, `check`, `build`,
`tour`) plus a path; pass `--help` for the usage string.

### VS Code extension

To install the editor extension locally from this repo (no marketplace
required):

```
pnpm vscode:install
```

This builds the extension, packages it as a `.vsix`, installs it via
the `code` CLI, and cleans up the artifact. Requires VS Code 1.94+
and the `code` command on your PATH (one-time setup: in VS Code,
Cmd-Shift-P → *Shell Command: Install 'code' command in PATH*). After
install, reload your VS Code window to activate.

For iterative extension development, F5 from `packages/vscode/` opens
a child VS Code window with the extension live-loaded.

## Packages

| Package | Purpose |
|---|---|
| [`@witlang/parser`](./packages/parser/) | Lexer + parser → typed AST. |
| [`@witlang/runtime`](./packages/runtime/) | Resolver + expander runtime. |
| [`@witlang/render-html`](./packages/render-html/) | HTML renderer. |
| [`@witlang/render-markdown`](./packages/render-markdown/) | Markdown renderer. |
| [`@witlang/cli`](./packages/cli/) | `wit` command-line tool. |
| [`@witlang/skill`](./packages/skill/) | Claude Code authoring skill — `npx @witlang/skill init` drops a `SKILL.md` into a downstream project so agents write Wit idiomatically. |

The VS Code extension lives in `packages/vscode/` and is not on npm
(install via `pnpm vscode:install` from a clone).

## Architecture

The pipeline runs in five stages. Each stage owns one TypeScript
package and a stable typed output:

```
   source.wit
       |
       v
  +---------+    +-----------+    +----------+    +---------+    +--------+
  |  lex    | -> |  parse    | -> | resolve  | -> | expand  | -> | render |
  | (chars) |    | (tokens   |    | (binding |    | (inline |    |  HTML  |
  |         |    |  -> AST)  |    |  + refs) |    |  + eval)|    |        |
  +---------+    +-----------+    +----------+    +---------+    +--------+
        @witlang/parser               @witlang/runtime            @witlang/render-html
```

- **lex / parse** — `packages/parser` turns the source string into an
  AST `Document`.
- **resolve** — `packages/runtime` walks the AST, binding every
  `@name` use to its `#name` definition (single-file or cross-file via
  `reference ./other.wit`).
- **expand** — same package, splices NodeDef bodies into use-sites,
  evaluates `(if …)`, unrolls `(each …)`, runs `<% … %>` scripts.
- **render** — `packages/render-html` walks the expanded AST and
  emits semantic HTML; `packages/render-markdown` does the same for
  Markdown.
- **driver** — `packages/cli` chains them behind one binary; the
  `packages/vscode` extension hosts an LSP that runs the same stages
  inside the editor.

## Status

**v0.1.0.** The language is feature-complete for the v0.1.0 scope:
nodes, definitions, additive partials, records, collections, data
access, conditionals, iteration, scripting, a 47-name core vocabulary,
tables, form-fill bodies, record-args, colon parameters, quoted
strings, multi-line values, and block-aware capture substitution.
727 tests across 42 files; zero external runtime dependencies.

## Repository layout

- `packages/parser` — lexer + parser, AST types, error codes.
- `packages/runtime` — resolver, expander, `lh` script bridge.
- `packages/render-html` — reference HTML renderer.
- `packages/render-markdown` — reference Markdown renderer.
- `packages/cli` — `wit` command-line driver.
- `packages/skill` — Claude Code authoring skill + `wit-skill init`
  installer.
- `packages/vscode` — VS Code extension (LSP client + server,
  TextMate grammar).
- `examples/` — one short `.wit` file per language feature
  ([see the tour](./examples/README.md)).
- `tests/` — fixtures (categorised), error sidecars, integration
  documents, shared test runner.
- `PLAN.md`, `RULES.md` — design log and engineering constraints.
- `wit-spec.pdf` — current iteration of the language spec.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Issues and PRs welcome —
I aim to triage within a week.

## License

[MIT](./LICENSE).
