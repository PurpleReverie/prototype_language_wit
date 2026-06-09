// Tests for parser-data.ts (record + collection literal scanning).

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import {
  tryParseCollectionFromText,
  tryParseRecordFromText,
} from './parser-data.js';
import type {
  Collection as CollectionNode,
  DataDef,
  NodeDef,
  Record as RecordNode,
  StringValue,
} from './ast.js';

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
  it('parses `#x: { a - 1 }` as a DataDef wrapping a Record', () => {
    // M7.datadef-classify: a single-line def whose value is purely a
    // record literal is data, not a node template.
    const doc = parse('#x: { a - 1 }');
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    expect(def.name).toBe('x');
    const rec = def.value as RecordNode;
    expect(rec.kind).toBe('record');
    expect(rec.fields[0].key).toBe('a');
  });

  it('preserves Text body (NodeDef) when value is not a record', () => {
    const doc = parse('#x: just a string');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.body[0].kind).toBe('text');
  });

  it('parses a multi-line record def body as DataDef', () => {
    const src = '#k: {\n  name - Aldous Vane\n  years at post - 31\n}';
    const doc = parse(src);
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    const rec = def.value as RecordNode;
    expect(rec.kind).toBe('record');
    expect(rec.fields.map((f) => f.key)).toEqual([
      'name',
      'years at post',
    ]);
  });
});

describe('tryParseCollectionFromText', () => {
  it('parses an empty collection `[ ]`', () => {
    const result = tryParseCollectionFromText('[ ]', BASE_LOC);
    expect(result).not.toBeNull();
    expect(result!.collection.items).toEqual([]);
  });

  it('parses comma-separated bare items', () => {
    const result = tryParseCollectionFromText('[ a, b, c ]', BASE_LOC);
    const items = result!.collection.items;
    expect(items.map((v) => (v as StringValue).value)).toEqual(['a', 'b', 'c']);
  });

  it('tolerates a trailing comma', () => {
    const result = tryParseCollectionFromText('[ a, b, c, ]', BASE_LOC);
    expect(result!.collection.items).toHaveLength(3);
  });

  it('newline-separated items', () => {
    const src = '[\n  a\n  b\n  c\n]';
    const result = tryParseCollectionFromText(src, BASE_LOC);
    expect(result!.collection.items).toHaveLength(3);
  });

  it('whitespace-only separator yields ONE multi-word StringValue', () => {
    const result = tryParseCollectionFromText('[ a b c ]', BASE_LOC);
    const items = result!.collection.items;
    expect(items).toHaveLength(1);
    expect((items[0] as StringValue).value).toBe('a b c');
  });

  it('multi-word items separated by commas', () => {
    const result = tryParseCollectionFromText(
      '[ moral failure, attention ]', BASE_LOC,
    );
    const items = result!.collection.items;
    expect(items.map((v) => (v as StringValue).value)).toEqual([
      'moral failure', 'attention',
    ]);
  });

  it('nested collections', () => {
    const result = tryParseCollectionFromText(
      '[ [ 1, 2 ], [ 3, 4 ] ]', BASE_LOC,
    );
    const items = result!.collection.items;
    expect(items).toHaveLength(2);
    const inner = items[0] as CollectionNode;
    expect(inner.kind).toBe('collection');
    expect(inner.items).toHaveLength(2);
  });

  it('records inside a collection', () => {
    const result = tryParseCollectionFromText(
      '[ { a - 1 }, { a - 2 } ]', BASE_LOC,
    );
    const items = result!.collection.items;
    expect(items).toHaveLength(2);
    const first = items[0] as RecordNode;
    expect(first.kind).toBe('record');
    expect(first.fields[0].key).toBe('a');
  });

  it('returns null when the text does not begin with `[`', () => {
    expect(tryParseCollectionFromText('not a collection', BASE_LOC)).toBeNull();
  });

  it('throws on an unclosed collection', () => {
    expect(() =>
      tryParseCollectionFromText('[ a, b', BASE_LOC),
    ).toThrow(/expected '\]'/);
  });
});

describe('parse — single-line def with collection literal body', () => {
  it('parses `#xs: [ a, b, c ]` as a DataDef wrapping a Collection', () => {
    // M7.datadef-classify: pure collection literal → DataDef.
    const doc = parse('#xs: [ a, b, c ]');
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    const coll = def.value as CollectionNode;
    expect(coll.kind).toBe('collection');
    expect(coll.items).toHaveLength(3);
  });

  it('parses a multi-line collection of records', () => {
    const src =
      '#sites: [\n  { name - A, status - ok }\n  { name - B, status - down }\n]';
    const doc = parse(src);
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    const coll = def.value as CollectionNode;
    expect(coll.kind).toBe('collection');
    expect(coll.items).toHaveLength(2);
    const first = coll.items[0] as RecordNode;
    expect(first.fields.map((f) => f.key)).toEqual(['name', 'status']);
  });
});
