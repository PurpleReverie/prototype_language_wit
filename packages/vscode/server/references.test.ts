// Tests for find-references.

import { describe, it, expect } from 'vitest';
import { stateFromSource } from './_test-helpers.js';
import { buildReferences } from './references.js';

describe('buildReferences', () => {
  it('finds all NodeUses of a NodeDef when cursor on the def header', () => {
    const src = '#hi\n  greeting\nhi#\n\n@hi()\n\n@hi()\n\n@hi()\n';
    const state = stateFromSource(src);
    const refs = buildReferences(state, 1, 2);
    expect(refs.length).toBeGreaterThanOrEqual(3);
  });

  it('finds all NodeUses when cursor is on one of the uses', () => {
    const src = '#hi\n  greeting\nhi#\n\n@hi()\n\n@hi()\n';
    const state = stateFromSource(src);
    const refs = buildReferences(state, 5, 2);
    expect(refs.length).toBe(2);
  });

  it('returns empty list when cursor is on a core-vocab use', () => {
    const state = stateFromSource('@em hi em@\n');
    expect(buildReferences(state, 1, 2)).toEqual([]);
  });

  it('returns empty when cursor not on any node', () => {
    const state = stateFromSource('text\n');
    expect(buildReferences(state, 1, 1)).toEqual([]);
  });

  it('finds access-path uses of a DataDef', () => {
    const src = '#p: { a - 1 } !!\n@p.a x.\n@p.a y.\n';
    const state = stateFromSource(src);
    const refs = buildReferences(state, 1, 2);
    expect(refs.length).toBeGreaterThanOrEqual(2);
  });
});
