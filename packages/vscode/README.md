# wit-vscode

VS Code extension for the Wit language (`.wit` files).

This package provides:

- Language registration for `.wit` files.
- TextMate grammar (syntax highlighting) — filled in by M5.tmlanguage.
- Language configuration (brackets, comments) — filled in by M5.language-config.
- LSP client + server — filled in by M5.client and M5.lsp-server.

## Status

Dev-time install only. This extension is not yet published to the VS Code
Marketplace. To try it locally, build the workspace and use the VS Code
"Run Extension" launch target, or package it with `vsce package` and
install the resulting `.vsix`.

## Layout

- `client/extension.ts` — VS Code extension entry point (LSP client).
- `server/server.ts` — language server.
- `syntaxes/wit.tmLanguage.json` — TextMate grammar.
- `language-configuration.json` — language-config for editor behavior.

This scaffold (M5.scaffold) creates placeholder files only. Subsequent
M5.* tasks fill them in.
