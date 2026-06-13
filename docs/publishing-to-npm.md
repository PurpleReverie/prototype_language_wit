# Publishing Wit to npm — runbook

End-to-end walkthrough for publishing the Wit packages to npm. Written
2026-06-12, verified against current npm docs on 2026-06-13.
Follow phases in order. The whole loop is about a half-day for the
first release; subsequent releases are ~15 minutes.

## What's current as of 2026-06-13

Verified against the npm docs and recent (May 2026) registry changes:

- **Staged publishing is GA** (npm 11.15+). `npm stage publish` uploads
  to a queue; a maintainer 2FA-approves to release. Direct `npm publish`
  still works for solo-maintainer one-shot releases — see Phase 3 for
  both paths.
- **2FA is now mandatory** for publishing (was "strongly recommended").
  New write-permission tokens enforce 2FA by default.
- **Classic tokens are being removed December 9** — use **granular
  access tokens** (90-day max lifetime for write scope) or **OIDC
  Trusted Publishing** for CI.
- `pnpm publish -r --access public` and `workspace:*` auto-rewrite
  still work exactly as the runbook describes.
- `publishConfig.access: "public"` still required for scoped packages
  on the free plan.
- Organizations are free if all packages are public.

---

## Decision points (settle before starting)

1. **Scope name.** Three patterns to choose between:
   - **Org scope `@wit`** — clean. Requires creating an npm org. Almost
     certainly taken (it's a short word).
   - **Org scope `@witlang`** — likely available. Free for public packages.
   - **Personal scope `@<yourname>`** — always yours. Lower-commitment.
     Reads as "tauraj's wit packages."

   For v0.1.0 personal scope or `@witlang` are both fine. Personal scope
   migrates to an org cleanly later (`npm dist-tag` + redirect) — npm
   does not currently auto-migrate, so it's not a one-shot decision but
   it's also not painful to defer.

2. **License — MIT or Apache 2.0.** MIT is the default for OSS dev tools
   (used by most of the JS/TS ecosystem). Apache 2.0 adds an explicit
   patent grant; useful if Wit might attract corporate adoption.

3. **Versioning strategy.** Lockstep (all 5 packages always at the same
   version) vs independent (each versions on its own changes). For 5
   small packages I recommend lockstep — simpler mental model, easier
   CHANGELOG. Switch to `changesets` if you outgrow that.

4. **Source maps in published artifacts.** Helps consumers debug into
   library code. Costs a bit of package size. Default: ship them.

---

## Phase 0 — One-time external setup (15 minutes)

All on npm's side, not the repo.

### 1. Get an npm account

```bash
npm whoami     # if no output, you're not logged in
npm adduser    # interactive: username, password, email
```

### 2. Enable 2FA on the npm account

**Required, not optional anymore** (changed May 2026). All publishing
needs either 2FA-on-the-account OR a granular access token with the
bypass-2FA permission. For solo manual publishes, 2FA-on-account is
simpler.

At npmjs.com → Settings → Two-factor auth → "Authorization and publishing."
Save the recovery codes somewhere safe. Use an authenticator app
(1Password, Authy, Google Authenticator) — SMS 2FA is deprecated.

### 3. Decide the scope, then check availability

```bash
npm view @witlang/parser           # if 404 — available
npm view wit-parser                # alternative
npm view @<yourname>/wit-parser    # personal scope, always yours
```

### 4. (If using an org scope) create the npm org

Visit `npmjs.com/org/create` — free for public packages. Or CLI:

```bash
npm org create witlang
```

---

## Phase 1 — Repo preparation (1–2 hours)

These are changes to `package.json` files and adding metadata. Done once.

### 5. Add a `LICENSE` file at repo root

MIT template:

```
MIT License

Copyright (c) 2026 Tauraj Greig

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 6. Update each publishable `package.json`

Per-package metadata. Apply to all 5 publishable packages
(parser, runtime, render-html, render-markdown, cli). Leave the
VS Code extension (`packages/vscode/package.json`) as `private: true`
— that goes to the VS Code Marketplace, not npm.

Template (using `@witlang/parser` as the example):

```json
{
  "name": "@witlang/parser",
  "version": "0.1.0",
  "private": false,
  "description": "Parser for the Wit markup language",
  "keywords": ["wit", "markup", "parser", "language", "ast"],
  "license": "MIT",
  "author": "Tauraj Greig",
  "repository": {
    "type": "git",
    "url": "https://github.com/<you>/wit.git",
    "directory": "packages/parser"
  },
  "homepage": "https://github.com/<you>/wit#readme",
  "bugs": "https://github.com/<you>/wit/issues",
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public"
  },
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

Per-package notes:

- **`@witlang/parser`** — no deps yet. As above.
- **`@witlang/runtime`** — same shape. Move `@wit/parser` from
  `devDependencies` to `dependencies` and rename to `@witlang/parser`.
- **`@witlang/render-html`** — move `@wit/parser` and `@wit/runtime`
  from `devDependencies` to `dependencies`.
- **`@witlang/render-markdown`** — same as render-html.
- **`@witlang/cli`** — move all 4 inter-package deps to `dependencies`.
  Verify the `bin` field:
  ```json
  "bin": { "wit": "./dist/bin.js" }
  ```
  And that `dist/bin.js` has shebang `#!/usr/bin/env node` on line 1.
- **`wit-vscode`** — leave `private: true`. Extension publishing is
  separate (see Phase 5 notes).

### 7. Rename all `@wit/` imports to `@witlang/` (or your chosen scope)

```bash
grep -rln '@wit/' packages tests | xargs sed -i '' 's|@wit/|@witlang/|g'
```

(macOS `sed` syntax with `-i ''`. On Linux drop the empty string.)

This touches about 20 files. Verify:

```bash
grep -rl '@wit/' packages tests   # should return nothing
pnpm build && pnpm test           # should still pass
```

### 8. Workspace dependency declarations stay `workspace:*`

In each `package.json` under `dependencies`:

```json
"dependencies": {
  "@witlang/parser": "workspace:*",
  "@witlang/runtime": "workspace:*"
}
```

pnpm rewrites `workspace:*` to a real version (`^0.1.0` by default) at
publish time. This is why we use `pnpm publish` and not `npm publish`
for workspaces.

### 9. Per-package READMEs

Each published package needs its own README — that's what shows on the
npm registry page. Root README is for the project, not the packages.

`packages/parser/README.md` already exists from the v0.1.0 hardening
pass. Add equivalents for runtime, render-html, render-markdown, cli.

Minimum template (10 lines):

````markdown
# @witlang/runtime

Resolver + expander for the Wit markup language. Consumes a parsed
`Document` from `@witlang/parser` and produces a fully-expanded AST
ready for rendering.

## Install

```
npm install @witlang/runtime
```

## Use

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';

const doc = parse(source, 'inline');
const resolved = resolve(doc);
const expanded = expand(resolved);
```

See [github.com/<you>/wit](https://github.com/<you>/wit) for the
language reference.
````

### 10. Add `CHANGELOG.md` at repo root

```markdown
# Changelog

## 0.1.0 — 2026-06-12

Initial public release.

Packages:

- `@witlang/parser` — lexer + parser → AST.
- `@witlang/runtime` — resolver + expander.
- `@witlang/render-html` — HTML renderer.
- `@witlang/render-markdown` — Markdown renderer.
- `@witlang/cli` — `wit parse | check | build | tour` command-line tool.

Language features:

- Nodes, definitions, additive partials, records, collections.
- Data access, conditionals, iteration, scripting.
- 47-name core vocabulary (h1-h6, dl/dt/dd, ul/li, table, etc.).
- Tables (inline-CSV, schema-array, schema-record forms).
- Opaque `@node` pass-through.
- Form-fill body shape (`key: value` lines).
- Record-args (`@x { a - 1, b - 2 }`).
- Colon parameters (`@x(a: 1)`), quoted strings, multi-line values.
- Block-aware capture substitution (records carry block-level content).
- VS Code language extension (LSP: hover, definition, references,
  completion, semantic tokens, diagnostics).

Known limitations: see `packages/parser/README.md`.
```

---

## Phase 2 — Smoke test before publishing (30 minutes)

Catch problems locally, not after the world sees broken packages.

### 11. Clean build from scratch

```bash
rm -rf packages/*/dist node_modules
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

If tests are red, fix before continuing.

### 12. Pack each publishable package locally

```bash
for pkg in parser runtime render-html render-markdown cli; do
  (cd packages/$pkg && pnpm pack)
done
```

Each command generates a `.tgz`. Inspect the contents of one:

```bash
tar -tzf packages/parser/witlang-parser-0.1.0.tgz | head -30
```

Verify:

- Only `dist/` JS + `.d.ts` + README + LICENSE + package.json are in there.
- No `.ts` source files (you removed `src` from `files`).
- No `.test.js` or test fixtures.
- Source maps present if you wanted them, absent if you didn't.

### 13. Install the tarballs into a scratch project

```bash
mkdir /tmp/wit-smoke && cd /tmp/wit-smoke
npm init -y
npm install /Users/taurajgreig/Projects/Personal/prototype_language_wit/packages/cli/witlang-cli-0.1.0.tgz
```

This pulls cli + parser + runtime + render-html + render-markdown
because they're in `dependencies`.

Test the binary:

```bash
echo '# Hello *world*.' > test.wit
npx wit tour test.wit
```

Gotchas if `wit` isn't on PATH:

- The `bin` field in `cli/package.json` points to a non-existent file.
- The shebang `#!/usr/bin/env node` is missing from `dist/bin.js`.
- The file lacks executable permission (npm should fix on install).

### 14. Test the parser as a library

```ts
// /tmp/wit-smoke/test.ts
import { parse } from '@witlang/parser';
const doc = parse('Hello *world*.', 'inline');
console.log(JSON.stringify(doc, null, 2));
```

```bash
npx tsx test.ts
```

Should print the AST. If imports fail, the `exports` or `types` paths
in `package.json` are wrong.

### 15. Test the full pipeline

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import { renderHtml } from '@witlang/render-html';

const doc = parse('# Title\n\nThis is *Wit*.', 'inline');
const resolved = resolve(doc);
const expanded = expand(resolved);
const html = renderHtml(expanded);
console.log(html);
```

If anything fails to import, the public exports in `index.ts` of that
package need to be widened to expose what the consumer needs.

---

## Phase 3 — Publishing (5 minutes)

### 16. Log in to npm from CLI

```bash
npm login    # browser-based flow with 2FA
npm whoami   # verify
```

### 17. Publish in dependency order

Two paths now. Pick one.

**Path A — direct publish (simplest, fine for v0.1.0)**

```bash
pnpm publish -r --access public --otp=<your-2fa-code>
```

`-r` = recursive (all workspace packages).
`--access public` = required for scoped packages on free plan.
`--otp=<code>` = your current 2FA code. Without this, npm prompts
per package, which doesn't work well for `-r` mode (the code expires
across 5 publishes). Generate one OTP, pass it on the command line.

`--no-git-checks` is available to bypass the dirty-tree refusal — only
use if you're sure (e.g., a CHANGELOG bump you haven't committed yet).

**Path B — staged publish (recommended for v0.2+ and CI)**

Available in npm 11.15+ (May 2026 GA). The publish goes to a stage
queue, then you (or another maintainer) interactively approve before
it goes live. Blocks stolen-token attacks.

```bash
# 1. Upload to staging
pnpm exec npm stage publish -r --access public

# 2. Review what's staged
npm stage list

# 3. Inspect a specific staged package
npm stage view @witlang/parser@0.1.0

# 4. Approve (requires interactive 2FA — cannot be automated)
npm stage approve @witlang/parser@0.1.0

# Repeat approve for each of the 5 packages, OR
npm stage approve --all
```

The `stage approve` step requires interactive 2FA — designed so a
compromised CI token cannot bypass the gate. For solo manual publishes
this is one extra step per package; for CI publishes it's the whole
point.

**Either path:** publish/stage in pnpm's dep-graph order (parser →
runtime → renderers → cli) happens automatically via `-r`.

### 18. Verify on npm

```bash
npm view @witlang/parser
npm view @witlang/cli
```

Or visit `https://www.npmjs.com/package/@witlang/parser` in a browser.
The README should render. The version should be 0.1.0. The license
should be MIT.

### 19. Smoke test from a real machine

```bash
mkdir test && cd test
npm install -g @witlang/cli
echo 'Hello *world*.' > x.wit
wit tour x.wit
```

If that works end-to-end, you're live.

---

## Phase 4 — GitHub release (5 minutes)

### 20. Push commits to origin

```bash
git push origin main
```

### 21. Create a tag

```bash
git tag -a v0.1.0 -m "Wit v0.1.0 — initial public release"
git push origin v0.1.0
```

### 22. Cut a GitHub Release

On the repo page → "Releases" → "Draft a new release" → select tag
v0.1.0 → write release notes (copy from CHANGELOG.md) → publish.

Optional: attach the `.tgz` artifacts from Phase 2 step 12 to the
release so people without npm can download directly.

---

## Phase 5 — VS Code extension (optional, separate from npm)

The Wit VS Code extension is its own publish path. Skip this for
v0.1.0 if you want to ship just the language. Bring it in for v0.2.0.

To publish:

1. Create a Visual Studio Marketplace publisher account at
   `marketplace.visualstudio.com/manage/createpublisher`.
2. Install vsce: `pnpm add -D vsce` in `packages/vscode/`.
3. Set the `publisher` field in `packages/vscode/package.json` to your
   publisher ID.
4. `cd packages/vscode && pnpm exec vsce publish`.

The extension code is already set up (M12 work). It bundles the LSP
server alongside the client extension. Just needs the marketplace
account.

---

## Per-release workflow after v0.1.0

For subsequent releases, the loop is short:

1. Land changes on `main`.
2. Bump versions: `pnpm -r exec npm version patch` (or `minor` / `major`).
3. Update `CHANGELOG.md` (move "Unreleased" to the new version block).
4. Commit: `git commit -am "v0.1.1"`.
5. `pnpm publish -r --access public --otp=<code>` (or staged path).
6. `git tag v0.1.1 && git push origin main v0.1.1`.
7. Cut a GitHub release.

You can automate steps 2-7 with `changesets` (designed for monorepos)
once you have a release cadence.

### Automating publishes (when you outgrow manual)

Modern path is **OIDC Trusted Publishing** — no tokens, no secrets:

1. At npmjs.com → package settings → Trusted Publishers → "Add".
2. Provide your GitHub org/repo + workflow file path.
3. GitHub Actions can then publish without any npm token stored as a secret —
   the workflow's OIDC identity is exchanged for a short-lived publish token.

Trusted publishing can also be configured to require stage-only — meaning
even the CI cannot direct-publish; it can only stage, and a human approves.

If you prefer the older token approach, **granular access tokens** are
the current recommendation (NOT classic tokens — those are being removed
December 9, 2026):

1. npmjs.com → Settings → Tokens → "Generate New Token" → "Granular Access Token".
2. Scope: "Read and write" + restrict to specific packages.
3. Max lifetime: 90 days for write-permission tokens.
4. Store as `NPM_TOKEN` in GitHub Actions secrets.
5. Use in workflow: `pnpm publish -r --access public` (npm reads `NPM_TOKEN`).

---

## Common gotchas

| Symptom | Cause |
|---|---|
| `npm ERR! 402 Payment Required` on publish | Forgot `publishConfig.access: "public"` on a scoped package. |
| `npm install @witlang/cli` works but `wit` command not found | `bin` field path wrong, OR shebang missing from compiled `bin.js`. |
| Consumer can't `import { parse }` — "Cannot find module" | `exports` field doesn't include the path, OR `types` is missing. |
| `pnpm publish` rewrites `workspace:*` to `0.0.0` | Workspace package wasn't built — `dist/` is empty so version detection fails. Run `pnpm build` first. |
| Published package contains test files / fixtures | `files` array missing from package.json — defaults to "everything not gitignored." Add explicit whitelist. |
| Consumer install fails: "Cannot find @witlang/runtime" | Inter-package dep is still in `devDependencies` of the consumer. Must be in `dependencies`. |
| `pnpm publish` fails on second package after first succeeded | First package took the only OTP. Re-run with `--otp=...` per package OR pass `--otp=<code>` ONCE on the `-r` command line (works because the recursive run completes within the OTP window) OR use granular access tokens with bypass-2FA. Do NOT disable 2FA — it's mandatory now. |
| `npm publish` rejected with "use stage publish instead" | The package has trusted publishing configured as stage-only. Use `npm stage publish` then `npm stage approve`. |
| Classic token stopped working | They're being phased out (December 9 deadline). Migrate to granular access tokens or OIDC trusted publishing. |

---

## Pre-publish checklist (printable)

Before running `pnpm publish -r`:

- [ ] `npm whoami` returns your username
- [ ] LICENSE file at repo root
- [ ] CHANGELOG.md updated with v0.1.0 entry
- [ ] `private: false` on all 5 publishable packages
- [ ] `publishConfig.access: "public"` on all 5
- [ ] Scope renamed consistently across all package.json + imports
- [ ] Inter-package deps moved from devDependencies → dependencies
- [ ] Each package has a README (parser already has one; add 4 more)
- [ ] `engines.node` set on each
- [ ] `description`, `keywords`, `repository`, `license`, `author` on each
- [ ] `files` whitelist on each (no source maps if you don't want them, no .ts)
- [ ] Clean build green: `pnpm install --frozen-lockfile && pnpm build && pnpm test`
- [ ] `pnpm pack` on each, contents inspected
- [ ] Local install + smoke test passes (Phase 2 step 13)
- [ ] CLI binary works after install (Phase 2 step 13, `wit tour`)
- [ ] Programmatic API works (Phase 2 step 14)
- [ ] Repo pushed to `origin/main` already (push the 3 unpushed commits)

After `pnpm publish -r`:

- [ ] All 5 packages visible on npmjs.com
- [ ] Global install of `@witlang/cli` works on a clean machine
- [ ] Tag `v0.1.0` pushed
- [ ] GitHub Release published
- [ ] README updated with install instructions

---

## What's already done as of 2026-06-12

So you remember when you wake up:

- Language is feature-complete for v0.1.0 — 727 tests passing.
- 8 milestones landed since the start (M13 record-args, M14 markdown
  spacing, M15 form-fill + colon + scatter + quoted strings + escapes,
  M15-followup raw lines, emphasis-in-captures, M16 multi-line values,
  self-closing precedence fix, M17 block-aware capture substitution).
- `packages/parser/README.md` written.
- `wit tour --report` works (`pnpm test:tour`).
- 24 of 24 AST kinds produced and asserted.
- 3 unpushed commits on `main` (self-closing fix, feature-tour +
  hardening, M17).
- All packages still `private: true` and named `@wit/*` — these are
  what Phase 1 changes.

Next move when you wake up: pick a scope name, then start at Phase 1
step 5 (LICENSE file).
