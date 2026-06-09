// Integration-fixture snapshot harness. Mirrors `fixtures.test.ts` but
// walks `tests/integration/` where each `.wit` source is parsed
// independently and snapshotted next to it.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parse } from '@wit/parser';

import {
  diffSnapshot,
  readFlags,
  serializeAst,
  writeSnapshot,
} from './snapshot.js';
import { walkIntegration, type FixtureEntry } from './walk.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const INTEGRATION_ROOT = resolve(REPO_ROOT, 'tests', 'integration');

const FLAGS = readFlags(process.env);
const ENTRIES = walkIntegration({
  integrationRoot: INTEGRATION_ROOT,
  repoRoot: REPO_ROOT,
});

describe('integration snapshot harness', () => {
  it('discovers at least one integration fixture', () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  for (const entry of ENTRIES) {
    it(entry.label, () => runFixture(entry));
  }
});

function runFixture(entry: FixtureEntry): void {
  const source = readFileSync(entry.witPath, 'utf8');
  const envelope = buildEnvelope(source, entry.label);
  const actual = serializeAst(envelope, { withLoc: FLAGS.withLoc });
  if (FLAGS.update) {
    writeSnapshot(entry.snapshotPath, actual);
    return;
  }
  assertSnapshotMatches(entry, actual);
}

function buildEnvelope(source: string, file: string): unknown {
  try {
    const ast = parse(source, file);
    return { ok: true, ast };
  } catch (err) {
    return { ok: false, error: serializeError(err) };
  }
}

function serializeError(err: unknown): unknown {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown; loc?: unknown };
    const out: Record<string, unknown> = {
      message: typeof e.message === 'string' ? e.message : String(err),
    };
    if (typeof e.code === 'string') out.code = e.code;
    if (e.loc !== undefined) out.loc = e.loc;
    return out;
  }
  return { message: String(err) };
}

function assertSnapshotMatches(entry: FixtureEntry, actual: string): void {
  const diff = diffSnapshot(entry.snapshotPath, actual);
  if (diff.status === 'equal') return;
  if (diff.status === 'missing') {
    throw new Error(
      `snapshot missing for ${entry.label}\n` +
        `expected at: ${entry.snapshotPath}\n` +
        `run with WIT_SNAPSHOT_UPDATE=1 to generate.`
    );
  }
  throw new Error(
    `snapshot mismatch for ${entry.label}\n` +
      `snapshot: ${entry.snapshotPath}\n` +
      `diff (truncated):\n${diff.preview ?? ''}\n` +
      `run with WIT_SNAPSHOT_UPDATE=1 to refresh.`
  );
}
