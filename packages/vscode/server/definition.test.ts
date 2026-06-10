// Tests for go-to-definition.

import { describe, it, expect } from 'vitest';
import { stateFromSource } from './_test-helpers.js';
import { buildDefinition } from './definition.js';

describe('buildDefinition', () => {
  it('returns the NodeDef location when cursor is on a NodeUse', () => {
    const src = '#hi\n  greeting\nhi#\n\n@hi()\n';
    const state = stateFromSource(src);
    const locs = buildDefinition(state, 5, 2);
    expect(locs).toHaveLength(1);
    expect(locs[0]?.range.start.line).toBe(0); // line 1 → 0-indexed
  });

  it('returns the DataDef location for an access path', () => {
    const src = '#p: { a - 1 } !!\nSee @p.a.\n';
    const state = stateFromSource(src);
    const locs = buildDefinition(state, 2, 8);
    expect(locs.length).toBe(1);
    expect(locs[0]?.range.start.line).toBe(0);
  });

  it('returns empty for core-vocab uses (no binding)', () => {
    const state = stateFromSource('@em hi em@\n');
    const locs = buildDefinition(state, 1, 2);
    expect(locs).toEqual([]);
  });

  it('returns empty when cursor is on plain text', () => {
    const state = stateFromSource('plain text\n');
    const locs = buildDefinition(state, 1, 1);
    expect(locs).toEqual([]);
  });
});
