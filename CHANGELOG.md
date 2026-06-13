# Changelog

All notable changes to Wit will be documented in this file.

## 0.1.0 — 2026-06-13

Initial public release.

### Packages

- `@witlang/parser` — lexer + parser → typed AST.
- `@witlang/runtime` — resolver + expander.
- `@witlang/render-html` — HTML renderer.
- `@witlang/render-markdown` — Markdown renderer.
- `@witlang/cli` — `wit` command-line tool (parse, check, build, tour).

### Language features

- Nodes, definitions, additive partials, records, collections.
- Data access, conditionals, iteration, scripting.
- 47-name core vocabulary (h1-h6, dl/dt/dd, ul/li, table, etc.).
- Tables (inline-CSV, schema-array, schema-record forms).
- Opaque `@node` pass-through.
- Form-fill body shape (`key: value` lines).
- Record-args (`@x { a - 1, b - 2 }`).
- Colon parameters, quoted strings, multi-line values.
- Block-aware capture substitution.
- VS Code language extension (separate from npm publish; install via `pnpm vscode:install`).

### Known limitations

See `packages/parser/README.md` for current edge cases.
