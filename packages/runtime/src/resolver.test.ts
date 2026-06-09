import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve } from './resolver.js';

describe('resolver scaffold', () => {
  it('produces a resolved-document shape from a one-line doc', () => {
    const doc = parse('Hello Wit\n', '<inline>');
    const resolved = resolve(doc);
    expect(resolved.kind).toBe('resolved-document');
    expect(resolved.children).toBe(doc.children);
    expect(resolved.definitions.size).toBe(0);
    expect(resolved.references.size).toBe(0);
    expect(resolved.loc).toBe(doc.loc);
  });

  it('accepts an options object', () => {
    const doc = parse('x\n', '<inline>');
    const resolved = resolve(doc, {});
    expect(resolved.kind).toBe('resolved-document');
  });
});
