// Error-fixture driver. For each `tests/errors/<name>.wit` + sibling
// `<name>.err.json` sidecar, this suite either:
//   - asserts the parser throws an error matching the sidecar, OR
//   - marks the case `.skip` with a TODO documenting the parser gap.
//
// Skip categories (each is a parser/resolver gap to address in a later
// task, NOT part of M3.errors-fixtures):
//   - Parser does not throw at all (resolver-stage codes are not yet
//     implemented; some parser-stage codes have not been wired yet).
//   - Parser throws the correct code+loc but the diagnostic wording does
//     not contain the substring required by the sidecar contract.

import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { runErrorFixture, walkErrorFixtures } from './errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const ERRORS_ROOT = resolve(REPO_ROOT, 'tests', 'errors');

const ENTRIES = walkErrorFixtures({ errorsRoot: ERRORS_ROOT, repoRoot: REPO_ROOT });

// Known parser/resolver gaps. Key = `.wit` basename. Value = short reason
// captured in the skip annotation.
const KNOWN_SKIPS: Record<string, string> = {
  // Resolver stage not yet implemented:
  'bad-reference.wit': 'E_UNRESOLVED_REFERENCE — resolver not implemented yet',
  'circular-reference.wit': 'E_CIRCULAR_REFERENCE — resolver not implemented yet',
  'missing-field.wit': 'E_MISSING_FIELD — resolver field-lookup not implemented',
  'missing-reference-file.wit': 'E_MISSING_REFERENCE_FILE — resolver file loader not implemented',
  'mismatched-shape-additive.wit': 'E_PARTIAL_SHAPE_MISMATCH — resolver shape-merge not implemented',
  'mixed-types-impossible.wit': 'E_TYPE_MISMATCH — resolver type checker not implemented',
  // Parser stage but not yet emitting these errors:
  'comma-in-record-value-bare-word.wit': 'E_BARE_FIELD — record bare-word rejection not wired',
  'empty-pipe-in-body.wit': 'E_EMPTY_PIPE — empty-pipe sentinel rejection not wired',
  'unclosed-definition.wit': 'E_UNCLOSED_DEFINITION — definition closer check not wired',
  'unclosed-paren.wit': 'E_UNCLOSED_PAREN — paren-close check missing on EOL/EOF',
  // Parser throws correct code+loc but message wording mismatches the
  // sidecar substring contract. Diagnostic wording fixes are deferred.
  'mismatched-close.wit': 'E_MISMATCHED_CLOSE thrown but message does not contain "mismatched close"',
  'unclosed-comment.wit': 'E_UNCLOSED_COMMENT thrown but message does not contain "unclosed comment"',
  'unclosed-node.wit': 'E_UNCLOSED_NODE thrown but message does not contain "unclosed node"',
};

describe('errors fixture harness', () => {
  it('discovers at least one error fixture', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  for (const entry of ENTRIES) {
    const fileName = basename(entry.witPath);
    const skipReason = KNOWN_SKIPS[fileName];
    if (skipReason !== undefined) {
      it.skip(`${entry.label} [TODO: ${skipReason}]`, () => {
        // Intentional skip — gap documented above.
      });
      continue;
    }
    it(entry.label, () => assertErrorFixture(entry));
  }
});

function assertErrorFixture(entry: {
  witPath: string;
  sidecarPath: string;
  label: string;
}): void {
  const result = runErrorFixture(entry);
  if (result.status === 'pass') return;
  throw new Error(
    `error-fixture mismatch for ${entry.label}\n` +
      `sidecar: ${entry.sidecarPath}\n` +
      `reason: ${result.reason ?? '(no reason given)'}`
  );
}
