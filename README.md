# Wit

Wit is a prose-first markup language for people who write — and the
systems that consume what they write. Documents read like normal text;
structure (nodes, data, conditionals, iteration, scripting) layers in
only where the author needs it. This repository contains the v0.1.0
reference implementation: a parser, a resolver/expander runtime, an
HTML renderer, a CLI, and a VS Code language extension.

## Quick start

```
pnpm install
pnpm build
node packages/cli/dist/bin.js parse path/to/file.wit
node packages/cli/dist/bin.js check path/to/file.wit
node packages/cli/dist/bin.js build path/to/file.wit -o out.html
```

The `wit` binary takes a single subcommand (`parse`, `check`, `build`)
plus a path; pass `--help` for the usage string.

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
        @wit/parser                   @wit/runtime                @wit/render-html
```

- **lex / parse** — `packages/parser` turns the source string into an
  AST `Document`.
- **resolve** — `packages/runtime` walks the AST, binding every
  `@name` use to its `#name` definition (single-file or cross-file via
  `reference ./other.wit`).
- **expand** — same package, splices NodeDef bodies into use-sites,
  evaluates `(if …)`, unrolls `(each …)`, runs `<% … %>` scripts.
- **render** — `packages/render-html` walks the expanded AST and
  emits semantic HTML.
- **driver** — `packages/cli` chains them behind one binary; the
  `packages/vscode` extension hosts an LSP that runs the same stages
  inside the editor.

## Status

**v0.1.0-alpha.** First non-development cut. The full pipeline runs
end-to-end on the example corpus, but the language surface is still
finalising and edge cases are tracked as open items. Not yet published
to npm or the VS Code marketplace.

## Repository layout

- `packages/parser` — lexer + parser, AST types, error codes.
- `packages/runtime` — resolver, expander, `lh` script bridge.
- `packages/render-html` — reference HTML renderer.
- `packages/cli` — `wit` command-line driver.
- `packages/vscode` — VS Code extension (LSP client + server,
  TextMate grammar).
- `examples/` — one short `.wit` file per language feature.
- `tests/` — fixtures (categorised), error sidecars, integration
  documents, shared test runner.
- `PLAN.md`, `RULES.md` — design log and engineering constraints.
- `wit-spec.pdf` — current iteration of the language spec.
