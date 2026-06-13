// Coverage harness for `tests/integration/feature-tour.wit`. The demo
// file is a one-stop showcase of every AST kind Wit's parser emits;
// this test:
//   1. Parses the demo file.
//   2. Walks the AST collecting every `kind` value seen.
//   3. Asserts the expected exhaustive set of kinds is present.
//   4. Snapshots the `wit tour` CLI output (sibling `.tour.txt`) to catch
//      regression in either the demo source or the tree-printer.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parse } from '@witlang/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const WIT_PATH = resolve(REPO_ROOT, 'tests', 'integration', 'feature-tour.wit');
const TOUR_SNAPSHOT_PATH = resolve(
  REPO_ROOT,
  'tests',
  'integration',
  'feature-tour.tour.txt',
);
const CLI_BIN = resolve(REPO_ROOT, 'packages', 'cli', 'dist', 'bin.js');

// Every `kind:` discriminator the demo file is expected to surface.
// All 24 AST kinds the parser can emit, including the typed scalars
// (`numberValue`, `booleanValue`, `nullValue`) wired up in v0.1.0.
const EXPECTED_KINDS: ReadonlyArray<string> = [
  'bodySlot',
  'bold',
  'booleanValue',
  'collection',
  'comment',
  'comparisonCondition',
  'dataDef',
  'document',
  'eachStatement',
  'existenceCondition',
  'ifStatement',
  'interpolation',
  'italic',
  'nodeDef',
  'nodeUse',
  'nullValue',
  'numberValue',
  'paragraph',
  'record',
  'reference',
  'scriptBlock',
  'scriptCall',
  'stringValue',
  'text',
];

describe('feature-tour coverage', () => {
  it('parses without error', () => {
    const source = readFileSync(WIT_PATH, 'utf8');
    const ast = parse(source, WIT_PATH);
    expect(ast.kind).toBe('document');
  });

  it('exercises every expected AST kind', () => {
    const source = readFileSync(WIT_PATH, 'utf8');
    const ast = parse(source, WIT_PATH);
    const kinds = collectKinds(ast);
    for (const k of EXPECTED_KINDS) {
      expect(kinds.has(k), `missing AST kind: ${k}`).toBe(true);
    }
  });

  it('tour output matches snapshot', () => {
    if (!existsSync(CLI_BIN)) {
      throw new Error(`CLI not built at ${CLI_BIN} — run pnpm build first.`);
    }
    // Snapshot the tree-only form (--no-report) for stability — the
    // report-mode header includes a timing measurement that would
    // create per-run noise.
    const result = spawnSync(
      'node', [CLI_BIN, 'tour', '--no-report', WIT_PATH], { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`wit tour failed (exit ${result.status}): ${result.stderr}`);
    }
    const actual = result.stdout;
    if (process.env.WIT_SNAPSHOT_UPDATE === '1' || !existsSync(TOUR_SNAPSHOT_PATH)) {
      writeFileSync(TOUR_SNAPSHOT_PATH, actual, 'utf8');
      return;
    }
    const expected = readFileSync(TOUR_SNAPSHOT_PATH, 'utf8');
    expect(actual).toBe(expected);
  });

  it('report mode prints header + footer summary', () => {
    if (!existsSync(CLI_BIN)) {
      throw new Error(`CLI not built at ${CLI_BIN} — run pnpm build first.`);
    }
    const result = spawnSync(
      'node', [CLI_BIN, 'tour', '--report', WIT_PATH], { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      throw new Error(`wit tour failed (exit ${result.status}): ${result.stderr}`);
    }
    const out = result.stdout;
    // Header: known anchors. Source bytes/lines vary as the demo file
    // evolves so we only check the labels.
    expect(out).toMatch(/^Wit feature tour\n={4,}\n/);
    expect(out).toMatch(/^File: .+feature-tour\.wit$/m);
    expect(out).toMatch(/^Source: \d+ bytes, \d+ lines$/m);
    expect(out).toMatch(/^Parsed in: \d+ms$/m);
    // Footer summary: every expected kind must be present, plus a
    // 24/24 coverage line (no missing kinds).
    expect(out).toMatch(/^Summary$/m);
    expect(out).toMatch(/^  AST kinds seen: 24\/24$/m);
    expect(out).toMatch(/^  NodeUse paramsSource variants: .+$/m);
    expect(out).toMatch(/^  NodeDef shapes: .+$/m);
    expect(out).toMatch(/^  Errors: 0$/m);
    expect(out.includes('Missing kinds:')).toBe(false);
  });
});

function collectKinds(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) collectKinds(child, acc);
    return acc;
  }
  if (node === null || typeof node !== 'object') return acc;
  const n = node as Record<string, unknown>;
  if (typeof n.kind === 'string') acc.add(n.kind);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'kind') continue;
    collectKinds(n[key], acc);
  }
  return acc;
}
