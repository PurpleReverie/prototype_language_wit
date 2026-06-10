// Tests for hover content builder.

import { describe, it, expect } from 'vitest';
import { stateFromSource } from './_test-helpers.js';
import { buildHover } from './hover.js';

describe('buildHover', () => {
  it('describes a NodeDef when hovering its header', () => {
    const state = stateFromSource('#hello\n  greeting\nhello#\n');
    const hover = buildHover(state, 1, 2);
    expect(hover?.contents).toContain('NodeDef');
    expect(hover?.contents).toContain('hello');
  });

  it('describes a NodeUse with binding context', () => {
    const src = '#hello\n  greeting\nhello#\n\n@hello()\n';
    const state = stateFromSource(src);
    const hover = buildHover(state, 5, 2);
    expect(hover?.contents).toContain('hello');
  });

  it('flags core-vocab names as such', () => {
    const state = stateFromSource('@em hi em@\n');
    const hover = buildHover(state, 1, 2);
    expect(hover?.contents).toContain('core vocabulary');
  });

  it('flags @node as opaque pass-through', () => {
    const state = stateFromSource('@node(type custom)\n');
    const hover = buildHover(state, 1, 2);
    expect(hover?.contents).toContain('opaque');
  });

  it('returns null when position is outside any span', () => {
    const state = stateFromSource('plain text here.\n');
    const hover = buildHover(state, 1, 1);
    expect(hover).toBeNull();
  });

  it('describes a DataDef on hover', () => {
    const state = stateFromSource('#paper: { name - Foo, year - 2024 } !!\n');
    const hover = buildHover(state, 1, 2);
    expect(hover?.contents).toContain('DataDef');
    expect(hover?.contents).toContain('Fields');
  });

  it('describes an access segment as a field', () => {
    const state = stateFromSource('#p: { a - 1 } !!\nSee @p.a now.\n');
    const hover = buildHover(state, 2, 8);
    expect(hover?.contents.toLowerCase()).toContain('field');
  });
});
