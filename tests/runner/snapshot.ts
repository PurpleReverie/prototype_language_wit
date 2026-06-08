// Snapshot serialization + load/diff/write helpers.
//
// The AST is serialized to a deterministic JSON string using alphabetic
// key ordering and 2-space indentation. By default `loc` fields are
// elided to keep snapshots readable and stable under purely cosmetic
// source changes; set `WIT_SNAPSHOT_WITH_LOC=1` to retain them.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SerializeOptions {
  // When true, `loc` fields are kept verbatim. Default: false.
  withLoc: boolean;
}

export interface RuntimeFlags {
  // `WIT_SNAPSHOT_UPDATE=1` — regenerate every snapshot.
  update: boolean;
  // `WIT_SNAPSHOT_WITH_LOC=1` — include `loc` fields when serializing.
  withLoc: boolean;
}

export function readFlags(env: NodeJS.ProcessEnv): RuntimeFlags {
  return {
    update: env.WIT_SNAPSHOT_UPDATE === '1',
    withLoc: env.WIT_SNAPSHOT_WITH_LOC === '1',
  };
}

export function serializeAst(ast: unknown, opts: SerializeOptions): string {
  const normalized = normalize(ast, opts);
  return JSON.stringify(normalized, null, 2) + '\n';
}

function normalize(node: unknown, opts: SerializeOptions): unknown {
  if (Array.isArray(node)) return node.map((n) => normalize(n, opts));
  if (node === null || typeof node !== 'object') return node;
  return normalizeObject(node as Record<string, unknown>, opts);
}

function normalizeObject(
  obj: Record<string, unknown>,
  opts: SerializeOptions
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const k of keys) {
    if (k === 'loc' && !opts.withLoc) continue;
    out[k] = normalize(obj[k], opts);
  }
  return out;
}

export interface DiffResult {
  // `equal` when both blobs match byte-for-byte.
  status: 'equal' | 'mismatch' | 'missing';
  // Present when status === 'mismatch': a short unified-style preview.
  preview?: string;
}

export function diffSnapshot(
  snapshotPath: string,
  actual: string
): DiffResult {
  if (!existsSync(snapshotPath)) return { status: 'missing' };
  const expected = readFileSync(snapshotPath, 'utf8');
  if (expected === actual) return { status: 'equal' };
  return { status: 'mismatch', preview: previewDiff(expected, actual) };
}

export function writeSnapshot(snapshotPath: string, actual: string): void {
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, actual, 'utf8');
}

function previewDiff(expected: string, actual: string): string {
  const expLines = expected.split('\n');
  const actLines = actual.split('\n');
  const max = Math.max(expLines.length, actLines.length);
  const lines: string[] = [];
  for (let i = 0; i < max && lines.length < 20; i++) {
    if (expLines[i] === actLines[i]) continue;
    if (expLines[i] !== undefined) lines.push(`- ${expLines[i]}`);
    if (actLines[i] !== undefined) lines.push(`+ ${actLines[i]}`);
  }
  return lines.join('\n');
}
