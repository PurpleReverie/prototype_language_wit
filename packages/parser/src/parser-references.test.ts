// Unit tests for `reference ./path.wit` block-level parsing
// (M3.references).

import { describe, expect, it } from 'vitest';

import { parse } from './parser.js';
import type { ReferenceDirective } from './ast.js';

function references(src: string): ReferenceDirective[] {
  const doc = parse(src);
  return doc.children.filter(
    (c): c is ReferenceDirective => c.kind === 'reference',
  );
}

describe('parseReferenceDirective', () => {
  it('produces a ReferenceDirective AST node', () => {
    const refs = references('reference ./one.wit\n');
    expect(refs).toHaveLength(1);
    expect(refs[0].kind).toBe('reference');
    expect(refs[0].path).toBe('./one.wit');
  });

  it('preserves source order across multiple references', () => {
    const refs = references('reference ./a.wit\nreference ./b.wit\n');
    expect(refs.map((r) => r.path)).toEqual(['./a.wit', './b.wit']);
  });

  it('keeps subsequent prose as a separate paragraph block', () => {
    const doc = parse('reference ./one.wit\n\nThe keeper.\n');
    expect(doc.children).toHaveLength(2);
    expect(doc.children[0].kind).toBe('reference');
    expect(doc.children[1].kind).toBe('paragraph');
  });

  it('accepts reference AFTER prose (hoisting)', () => {
    const doc = parse('Prose first.\n\nreference ./later.wit\n');
    const kinds = doc.children.map((c) => c.kind);
    expect(kinds).toContain('reference');
    expect(kinds).toContain('paragraph');
  });

  it('leaves mid-prose `reference` as plain text', () => {
    const doc = parse('See reference ./a.wit here.\n');
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].kind).toBe('paragraph');
  });
});
