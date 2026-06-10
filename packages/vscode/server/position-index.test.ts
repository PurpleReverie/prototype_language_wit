// Tests for the position index — build correctness and lookup.

import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { buildPositionIndex, lookupAt } from './position-index.js';

function indexOf(src: string) {
  return buildPositionIndex(parse(src));
}

describe('buildPositionIndex', () => {
  it('emits a nodeUse entry for an @name reference', () => {
    const entries = indexOf('#cite ::a:: cite#\n@cite |a Foo|\n');
    expect(entries.some((e) => e.kind === 'nodeUse')).toBe(true);
  });

  it('emits a nodeDef entry for #name definitions', () => {
    const entries = indexOf('#para\n  body\npara#\n');
    expect(entries.some((e) => e.kind === 'nodeDef')).toBe(true);
  });

  it('emits a dataDef entry for #x: { ... } !! literals', () => {
    const entries = indexOf('#paper: { name - Foo } !!\n');
    expect(entries.some((e) => e.kind === 'dataDef')).toBe(true);
  });

  it('emits an interpolation entry for ::name::', () => {
    const entries = indexOf('#cite ||a|| ::a:: text cite#\n');
    expect(entries.some((e) => e.kind === 'interpolation')).toBe(true);
  });

  it('emits accessSegment entries for @x.field access paths', () => {
    const entries = indexOf('#p: { a - 1 } !!\nHi @p.a there.\n');
    expect(entries.some((e) => e.kind === 'accessSegment')).toBe(true);
  });
});

describe('lookupAt', () => {
  it('returns the smallest span containing the cursor', () => {
    const src = '@em hello em@\n';
    const entries = buildPositionIndex(parse(src));
    const hit = lookupAt(entries, 1, 2);
    expect(hit?.kind).toBe('nodeUse');
  });

  it('returns undefined for positions outside any span', () => {
    const src = 'plain text\n';
    const entries = buildPositionIndex(parse(src));
    expect(lookupAt(entries, 1, 1)).toBeUndefined();
  });

  it('returns access segment entry when cursor sits on field', () => {
    const src = '#p: { name - Foo } !!\nSee @p.name now.\n';
    const entries = buildPositionIndex(parse(src));
    const hit = lookupAt(entries, 2, 8);
    expect(hit?.kind).toBe('accessSegment');
  });
});
