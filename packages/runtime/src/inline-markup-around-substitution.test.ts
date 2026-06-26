// W-2 / W-3 — inline markup around interpolation and body slot.
//
// `_::title::_` and `*...*` should render with the def-side emphasis
// applied to the substituted text, not leak the markers as literal
// characters.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import type { Block, Paragraph, Inline } from '@witlang/parser';

function expandSrc(src: string): Block[] {
  return expand(resolve(parse(src, '<test>'))).children;
}

function findInlines(blocks: Block[]): Inline[] {
  const out: Inline[] = [];
  for (const b of blocks) {
    if (b.kind === 'paragraph') {
      for (const c of (b as Paragraph).children) out.push(c);
    }
  }
  return out;
}

describe('W-2 — emphasis around `::name::` interpolation', () => {
  it('`_::title::_` parses italic around the interpolation', () => {
    const src = `#cite: ||a, y, title|| ::a:: (::y::). _::title::_. !!

@cite |a Smith| |y 2024| |title Lighthouses|.`;
    const blocks = expandSrc(src);
    const inlines = findInlines(blocks);
    const italic = inlines.find((i) => i.kind === 'italic');
    expect(italic).toBeDefined();
  });
});

describe('W-3 / W-3a — body slot `*...*` parses bold and trims edges', () => {
  it('`*...*` wraps body content in bold without leading/trailing space', () => {
    const src = `#shout: *...* !!

We can now @shout Yell shout@ inline.`;
    const blocks = expandSrc(src);
    const inlines = findInlines(blocks);
    const bold = inlines.find((i) => i.kind === 'bold');
    expect(bold).toBeDefined();
    if (bold && bold.kind === 'bold') {
      const txt = bold.children[0];
      expect(txt?.kind).toBe('text');
      if (txt?.kind === 'text') expect(txt.value).toBe('Yell');
    }
  });
});
