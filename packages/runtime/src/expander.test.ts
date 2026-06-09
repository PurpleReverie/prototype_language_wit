import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';

describe('expander scaffold', () => {
  it('produces an expanded-document shape from a resolved doc', () => {
    const doc = parse('Hello Wit\n', '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(expanded.kind).toBe('expanded-document');
    expect(expanded.children).toHaveLength(resolved.children.length);
    expect(expanded.loc).toEqual(resolved.loc);
  });

  it('deep-clones children so mutations do not leak back', () => {
    const doc = parse('a paragraph here\n', '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(expanded.children).not.toBe(resolved.children);
    for (let i = 0; i < expanded.children.length; i++) {
      expect(expanded.children[i]).not.toBe(resolved.children[i]);
      expect(expanded.children[i]).toEqual(resolved.children[i]);
    }
  });

  it('preserves shape for a doc with a NodeDef and a NodeUse', () => {
    const src = '#greet: hello\n\n@greet(world)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(expanded.kind).toBe('expanded-document');
    expect(expanded.children).toEqual(resolved.children);
  });
});
