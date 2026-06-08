// Unit tests for snapshot serialization + diff helpers.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  diffSnapshot,
  readFlags,
  serializeAst,
  writeSnapshot,
} from './snapshot.js';

describe('serializeAst', () => {
  it('orders object keys alphabetically', () => {
    const out = serializeAst(
      { b: 1, a: 2, c: 3 },
      { withLoc: false }
    );
    expect(out).toBe('{\n  "a": 2,\n  "b": 1,\n  "c": 3\n}\n');
  });

  it('drops loc fields by default', () => {
    const ast = { kind: 'document', loc: { file: 'x', line: 1 }, children: [] };
    const out = serializeAst(ast, { withLoc: false });
    expect(out).not.toContain('"loc"');
    expect(out).toContain('"kind": "document"');
  });

  it('retains loc fields when withLoc is true', () => {
    const ast = { kind: 'document', loc: { line: 1 } };
    const out = serializeAst(ast, { withLoc: true });
    expect(out).toContain('"loc"');
  });

  it('drops loc recursively in arrays', () => {
    const ast = {
      children: [
        { kind: 'paragraph', loc: { line: 1 }, value: 'a' },
      ],
    };
    const out = serializeAst(ast, { withLoc: false });
    expect(out).not.toContain('"loc"');
    expect(out).toContain('"value": "a"');
  });

  it('terminates output with a trailing newline', () => {
    const out = serializeAst({ a: 1 }, { withLoc: false });
    expect(out.endsWith('\n')).toBe(true);
  });

  it('serializes primitive values', () => {
    expect(serializeAst(5, { withLoc: false })).toBe('5\n');
    expect(serializeAst(null, { withLoc: false })).toBe('null\n');
  });
});

describe('diffSnapshot', () => {
  it('reports missing when the file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wit-snap-'));
    const result = diffSnapshot(join(dir, 'nope.json'), 'x');
    expect(result.status).toBe('missing');
  });

  it('reports equal when contents match', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wit-snap-'));
    const path = join(dir, 'a.json');
    writeSnapshot(path, 'hello\n');
    expect(diffSnapshot(path, 'hello\n').status).toBe('equal');
  });

  it('reports mismatch with a preview when contents differ', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wit-snap-'));
    const path = join(dir, 'a.json');
    writeSnapshot(path, 'one\n');
    const result = diffSnapshot(path, 'two\n');
    expect(result.status).toBe('mismatch');
    expect(result.preview).toContain('- one');
    expect(result.preview).toContain('+ two');
  });
});

describe('writeSnapshot', () => {
  it('creates parent directories as needed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wit-snap-'));
    const path = join(dir, 'nested', 'deep', 'a.json');
    writeSnapshot(path, 'payload\n');
    expect(readFileSync(path, 'utf8')).toBe('payload\n');
  });
});

describe('readFlags', () => {
  it('reads update flag from env', () => {
    expect(readFlags({ WIT_SNAPSHOT_UPDATE: '1' }).update).toBe(true);
    expect(readFlags({}).update).toBe(false);
  });

  it('reads withLoc flag from env', () => {
    expect(readFlags({ WIT_SNAPSHOT_WITH_LOC: '1' }).withLoc).toBe(true);
    expect(readFlags({}).withLoc).toBe(false);
  });
});
