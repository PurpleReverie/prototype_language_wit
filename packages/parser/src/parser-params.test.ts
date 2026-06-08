// Tests for parser-params.ts. Most coverage is exercised through
// parser-nodes.test.ts; this file isolates edge cases.

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import type { NodeUse, Paragraph } from './ast.js';

function nodeFromInline(src: string): NodeUse {
  const doc = parse(src);
  const p = doc.children[0] as Paragraph;
  return p.children[0] as NodeUse;
}

describe('params — paren form', () => {
  it('trailing comma `@x(a,)` keeps single param', () => {
    const n = nodeFromInline('@x(a,)');
    expect(n.params).toHaveLength(1);
    expect(n.params[0].value).toBe('a');
  });

  it('inner whitespace `@x( a , b )` trims values', () => {
    const n = nodeFromInline('@x( a , b )');
    expect(n.params[0].value).toBe('a');
    expect(n.params[1].value).toBe('b');
  });

  it('mixed named+flag in single param-list', () => {
    const n = nodeFromInline('@badge(tone good, verified!)');
    expect(n.params[0].name).toBe('tone');
    expect(n.params[0].value).toBe('good');
    expect(n.params[1].name).toBe('verified');
    expect(n.params[1].value).toBe('');
  });
});

describe('params — pipe form', () => {
  it('flag inside pipe `|full width!|`', () => {
    const doc = parse('@figure |full width!| figure@');
    const n = doc.children[0] as NodeUse;
    expect(n.params[0].name).toBe('full width');
    expect(n.params[0].value).toBe('');
  });

  it('hyphen multi-word `|background colour - dark slate|`', () => {
    const doc = parse('@panel |background colour - dark slate| panel@');
    const n = doc.children[0] as NodeUse;
    expect(n.params[0].name).toBe('background colour');
    expect(n.params[0].value).toBe('dark slate');
  });

  it('positional pipe `|full|`', () => {
    const doc = parse('@figure |full| figure@');
    const n = doc.children[0] as NodeUse;
    expect(n.params[0].name).toBeNull();
    expect(n.params[0].value).toBe('full');
  });
});
