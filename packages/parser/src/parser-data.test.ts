// Tests for parser-data.ts (record literal scanning).

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import { tryParseRecordFromText } from './parser-data.js';
import type { NodeDef, Record as RecordNode, StringValue } from './ast.js';

const BASE_LOC = { file: '<t>', line: 1, col: 1, offset: 0, length: 0 };

describe('tryParseRecordFromText', () => {
  it('parses an empty record `{ }`', () => {
    const result = tryParseRecordFromText('{ }', BASE_LOC);
    expect(result).not.toBeNull();
    expect(result!.record.kind).toBe('record');
    expect(result!.record.fields).toEqual([]);
  });

  it('parses a single-field inline record', () => {
    const result = tryParseRecordFromText('{ a - 1 }', BASE_LOC);
    expect(result).not.toBeNull();
    const rec = result!.record;
    expect(rec.fields).toHaveLength(1);
    expect(rec.fields[0].key).toBe('a');
    expect(rec.fields[0].value.kind).toBe('stringValue');
    expect((rec.fields[0].value as StringValue).value).toBe('1');
  });

  it('parses a multi-field inline record (comma-separated)', () => {
    const result = tryParseRecordFromText('{ a - 1, b - 2 }', BASE_LOC);
    const rec = result!.record;
    expect(rec.fields.map((f) => f.key)).toEqual(['a', 'b']);
    expect((rec.fields[1].value as StringValue).value).toBe('2');
  });

  it('tolerates a trailing comma', () => {
    const result = tryParseRecordFromText('{ a - 1, }', BASE_LOC);
    expect(result!.record.fields).toHaveLength(1);
  });

  it('parses newline-separated fields (multi-line body)', () => {
    const src = '{\n  a - 1\n  b - 2\n}';
    const result = tryParseRecordFromText(src, BASE_LOC);
    const rec = result!.record;
    expect(rec.fields.map((f) => f.key)).toEqual(['a', 'b']);
  });

  it('parses multi-word keys (`years at post - 31`)', () => {
    const result = tryParseRecordFromText('{ years at post - 31 }', BASE_LOC);
    const rec = result!.record;
    expect(rec.fields[0].key).toBe('years at post');
    expect((rec.fields[0].value as StringValue).value).toBe('31');
  });

  it('parses multi-word values (`name - Aldous Vane`)', () => {
    const result = tryParseRecordFromText('{ name - Aldous Vane }', BASE_LOC);
    expect((result!.record.fields[0].value as StringValue).value).toBe(
      'Aldous Vane',
    );
  });

  it('parses a nested record (brace value, no `-`)', () => {
    const result = tryParseRecordFromText('{ a { b - 1 } }', BASE_LOC);
    const rec = result!.record;
    expect(rec.fields[0].key).toBe('a');
    const inner = rec.fields[0].value as RecordNode;
    expect(inner.kind).toBe('record');
    expect(inner.fields[0].key).toBe('b');
  });

  it('returns null when the text does not begin with `{`', () => {
    expect(tryParseRecordFromText('not a record', BASE_LOC)).toBeNull();
  });

  it('throws on a malformed field (bare word after a comma)', () => {
    expect(() =>
      tryParseRecordFromText('{ msg - hello, world }', BASE_LOC),
    ).toThrow(/record field missing key/);
  });
});

describe('parse — single-line def with record literal body', () => {
  it('parses `#x: { a - 1 }` as a Record body', () => {
    const doc = parse('#x: { a - 1 }');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.shape).toBe('single-line');
    expect(def.body).toHaveLength(1);
    const rec = def.body[0] as RecordNode;
    expect(rec.kind).toBe('record');
    expect(rec.fields[0].key).toBe('a');
  });

  it('preserves Text body when value is not a record', () => {
    const doc = parse('#x: just a string');
    const def = doc.children[0] as NodeDef;
    expect(def.body[0].kind).toBe('text');
  });

  it('parses a multi-line record def body', () => {
    const src = '#k: {\n  name - Aldous Vane\n  years at post - 31\n}';
    const doc = parse(src);
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('single-line');
    const rec = def.body[0] as RecordNode;
    expect(rec.kind).toBe('record');
    expect(rec.fields.map((f) => f.key)).toEqual([
      'name',
      'years at post',
    ]);
  });
});
