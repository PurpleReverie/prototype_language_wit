// Tests for NodeDef parsing: block, single-line, value-block, captures,
// interpolation, body slot, additive prefix.

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import type { Interpolation, NodeDef, Paragraph } from './ast.js';

describe('parseNodeDef — block shape', () => {
  it('parses `#sidebar body sidebar#`', () => {
    const doc = parse('#sidebar\nbody text\nsidebar#');
    expect(doc.children).toHaveLength(1);
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.name).toBe('sidebar');
    expect(def.shape).toBe('block');
    expect(def.additive).toBe(false);
    expect(def.captures).toEqual([]);
  });
});

describe('parseNodeDef — single-line shape', () => {
  it('parses `#year: 1923 !!`', () => {
    const doc = parse('#year: 1923 !!');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.name).toBe('year');
    expect(def.shape).toBe('single-line');
    expect(def.body).toHaveLength(1);
  });
});

describe('parseNodeDef — value-block shape', () => {
  it('parses multi-line value with `!!` terminator', () => {
    const src = '#epigraph:\nThe sea does not forgive.\n— proverb\n!!';
    const doc = parse(src);
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('value-block');
    expect(def.body.length).toBeGreaterThan(0);
  });
});

describe('parseNodeDef — captures', () => {
  it('parses `#x ||a, b||` capture list', () => {
    const doc = parse('#x ||a, b||\nbody\nx#');
    const def = doc.children[0] as NodeDef;
    expect(def.captures).toEqual(['a', 'b']);
  });
});

describe('parseNodeDef — additive prefix', () => {
  it('parses `+#x: y !!` as additive single-line', () => {
    const doc = parse('+#x: y !!');
    const def = doc.children[0] as NodeDef;
    expect(def.additive).toBe(true);
    expect(def.shape).toBe('single-line');
    expect(def.name).toBe('x');
  });
});

describe('parseNodeDef — interpolation', () => {
  it('parses `::name::` as Interpolation in def body', () => {
    const doc = parse('#g ||name||\nHello, ::name::.\ng#');
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('block');
    const para = def.body[0] as Paragraph;
    expect(para.kind).toBe('paragraph');
    const interp = para.children.find(
      (c): c is Interpolation => c.kind === 'interpolation',
    );
    expect(interp?.name).toBe('name');
  });
});

describe('parseNodeDef — body slot', () => {
  it('parses `...` standalone as BodySlot marker', () => {
    const doc = parse('#wrapper\n...\nwrapper#');
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('block');
    const para = def.body[0] as Paragraph;
    const slot = para.children.find((c) => c.kind === 'bodySlot');
    expect(slot).toBeTruthy();
  });
});
