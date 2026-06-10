// Tests for context-aware completion.

import { describe, it, expect } from 'vitest';
import { stateFromSource } from './_test-helpers.js';
import { buildCompletion } from './completion.js';

describe('buildCompletion — CASE 1 (@)', () => {
  it('offers core-vocab names after @', () => {
    const src = '#a\n  x\na#\n\n@';
    const state = stateFromSource(src);
    const items = buildCompletion(state, 5, 2);
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['h1', 'em', 'table']));
  });

  it('offers user-defined NodeDef names after @', () => {
    const src = '#greet\n  hi\ngreet#\n\n@';
    const state = stateFromSource(src);
    const items = buildCompletion(state, 5, 2);
    expect(items.some((i) => i.label === 'greet')).toBe(true);
  });

  it('includes the opaque "node" name after @', () => {
    const state = stateFromSource('@');
    const items = buildCompletion(state, 1, 2);
    expect(items.some((i) => i.label === 'node')).toBe(true);
  });
});

describe('buildCompletion — CASE 2 (#)', () => {
  it('offers snippet scaffolds after #', () => {
    const state = stateFromSource('#');
    const items = buildCompletion(state, 1, 2);
    expect(items.some((i) => i.kind === 'Snippet')).toBe(true);
  });
});

describe('buildCompletion — CASE 5 (access path)', () => {
  it('offers record field names after @x.', () => {
    const src = '#paper: { title - T, year - 2024 } !!\n@paper.';
    const state = stateFromSource(src);
    const items = buildCompletion(state, 2, 9);
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['title', 'year']));
  });

  it('returns empty for non-record access', () => {
    const src = '#hi\n  x\nhi#\n@hi.';
    const state = stateFromSource(src);
    const items = buildCompletion(state, 4, 5);
    expect(items).toEqual([]);
  });
});

describe('buildCompletion — outside trigger', () => {
  it('returns empty when cursor is on plain text', () => {
    const state = stateFromSource('plain text');
    expect(buildCompletion(state, 1, 5)).toEqual([]);
  });
});
