# Wit — Overview Agent Memory

Persistent codebase knowledge maintained across task boundaries (per RULES.md rule 4).
This file is the overview agent's working memory; implementer/reviewer agents do not read it directly — they receive task briefings derived from it.

---

## Project goal

Wit is a prose-first markup language for writers and the systems that consume their writing. v1.0 ships: (1) a zero-dependency TypeScript parser library that emits a typed, source-located AST; (2) a small runtime (resolver + expander) that binds references and inlines definitions; (3) a reference HTML renderer; (4) a VS Code extension with minimal LSP; (5) a `.wit` fixture corpus that doubles as the executable spec; (6) docs (spec PDF, narrative examples, intro guide). The spec PDF (`wit-spec.pdf`) is the canonical reference; `examples/` pressure-tests the syntax.

---

## Architecture — 5-stage pipeline (PLAN section C)

```
source string
   -> Lexer       tokens with source locations
   -> Parser      raw AST (invocations unresolved)
   -> Resolver    bound AST (every @x linked to its #x)
   -> Expander    expanded AST (definitions inlined; if/each evaluated)
   -> Renderer    output (HTML / JSON / typeset / game tree)
```

Each stage is independently testable and replaceable. Every AST node carries `{ file, line, col, length }`. Tools that only need structure (LSP, formatter) stop after Parser or Resolver.

---

## Planned module layout (PLAN section L)

```
packages/
  parser/         lexer.ts, parser.ts, ast.ts, errors.ts, index.ts
  runtime/        resolver.ts, expander.ts, lh.ts, index.ts
  render-html/    reference renderer
  vscode/         extension + LSP (server/, client/, syntaxes/)
  cli/            wit build / wit parse / wit check
tests/
  fixtures/       00-lexical/ ... 17-combinations/  (.wit + .json snapshot pairs)
  integration/    whole-document tests
  errors/         .wit + .err.json pairs
  runner/         vitest.config.ts, snapshot.ts, walk.ts
.github/workflows/ci.yml
```

---

## Conventions

- **Language:** TypeScript, `strict: true`, ESM only (no CJS).
- **Package manager:** pnpm workspaces.
- **Test runner:** vitest, snapshot-based. `pnpm test` / `pnpm test --update`.
- **CI:** GitHub Actions on push: `pnpm install` -> `pnpm typecheck` -> `pnpm test` -> `pnpm build`.
- **Versioning:** Changesets; pre-1.0 = 0.x.
- **File size:** under 350 lines (RULES rule 1). Approaching the limit is a signal to extract.
- **Function size:** 20 lines (RULES rule 2). Use local helpers named for intent.
- **Parser package:** zero `dependencies` field per DS-18 (lint-checked).
- **Determinism:** sorted key iteration; same input -> same AST (DS-19).
- **Errors:** `WitError { code, message, loc }` with stable codes (`E_UNCLOSED_NODE`, etc).
- **AST:** serializable JSON, no cycles by structure (resolver uses handles, not pointers).

---

## File index (existing repo state)

- `/README.md` — project blurb + table of example files.
- `/PLAN.md` — comprehensive plan: vision, architecture, milestones M0–M7, user stories, dev stories DS-1..DS-21, TDD stories, open questions I.1–I.17, file layout, ops.
- `/RULES.md` — programming rules: file <350 lines, function <20 lines, per-task two-agent loop, overview agent (this), tester agent gating merge.
- `/wit-spec.pdf` — canonical language spec.
- `/cspell.json` — spellcheck config.
- `/examples/01-prose.wit` ... `17-scripting.wit` — narrative one-feature-per-file examples (incl. dirs `15-references/`, `16-additive-partials/`).
- `/.claude/settings.local.json` — Claude Code local settings.
- `/.agent-state/overview.md` — THIS FILE.

No `package.json`, no `tsconfig.json`, no `packages/`, no `tests/`, no `.github/` yet. M0 will create them.

---

## Open design questions (PLAN section I)

To be resolved during M1 (fixture-writing forces ambiguities to surface):

1. Are comments AST nodes or fully elided?
2. Single newline within a paragraph — collapse to space, or preserve as soft break?
3. Where can `@name.field` access appear — only in statements/params, or also in body prose?
4. Parameter values — always unquoted, or quoted for special chars?
5. Numeric literals in records — distinguished type or strings?
6. Bare reference vs prose: where does `@weil` end? Whitespace? Punctuation?
7. `!!` greedy-parse risk in body prose — context-only, always-reserved (`\!!` escape), or position-restricted?
8. Forward references — `@x` before `#x`? Lean yes (hoisted).
9. Definition scope — file-local or merged across references? Lean global within ref graph.
10. `lh.set(...)` immutability — mutate AST or layered overlay?
11. Mixing parens and pipes on same node — error or merge?
12. Multi-word flags via parens: `@badge(full width!)` — whole flag or single word?
13. `@scriptCall(fn)` — builtin or generic? Calling convention?
14. Source locations across additive partials — file-tagged child nodes?
15. Indentation in records/collections — required for multi-line or cosmetic?
16. Short-close `!!`: inline-only, or block-allowed?
17. Combining `!!` close with parens (`@name(p,q) body !!`) — allowed?

---

## Tasks completed

(none yet — Task 1: M0 scaffold is the next dispatch)

---

## Notes for next briefing cycle

- After M0 merges, update File index with new files: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `packages/parser/{package.json,tsconfig.json,src/ast.ts,src/index.ts}`, `tests/runner/vitest.config.ts`, `.github/workflows/ci.yml`, `.gitignore`.
- M1 next: fixture authoring. Will produce design-question resolutions for I.1–I.17 and bump spec to v0.2.
- Keep this file under 250 lines. Prune resolved design questions into a separate "Decisions" section once they land.
