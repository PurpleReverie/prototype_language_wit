// W-19 — italic markers inside a record value do not downgrade
// `#name: [ ... ] !!` from dataDef to nodeDef.
//
// Pre-fix, the inline parser ran first and split the body's single Text
// node around the `_x_` italic, so the data-value detector saw a
// multi-node body and fell through to nodeDef. Post-fix, a raw-text
// data-value probe runs before inline parsing.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { DataDef, NodeDef } from './ast.js';

describe('W-19 — record value with underscores stays dataDef', () => {
  it('collection of one record with `_x_` inside parses as dataDef', () => {
    const src = `#refs: [
  { body - A study. _Neural Networks_ 106. }
] !!`;
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('dataDef');
    const data = doc.children[0] as DataDef;
    expect(data.value.kind).toBe('collection');
  });

  it('record literal with `_x_` inside parses as dataDef', () => {
    const src = `#x: { title - _Journal Name_ here } !!`;
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('dataDef');
  });

  it('`*x*` inside a record value also stays dataDef', () => {
    const src = `#x: { title - *Bold word* in title } !!`;
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('dataDef');
  });

  it('fall-through: a malformed record body is still a nodeDef', () => {
    // No valid collection / record literal — probe returns null and the
    // regular path makes a nodeDef.
    const src = `#x: just prose with _italic_ here !!`;
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('nodeDef');
    const def = doc.children[0] as NodeDef;
    // Body should contain an italic node.
    expect(def.body.some((n) => n.kind === 'italic')).toBe(true);
  });
});
