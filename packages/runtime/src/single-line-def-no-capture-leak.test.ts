// W-1 — single-line def `||captures||` does not leak to body output.
//
// Pre-fix, a single-line def written as
//   #cite: ||author, year|| ::author:: (::year::). !!
// kept the capture-list text inside the body, so every invocation of
// @cite emitted "author, year " before the substituted values.
// Post-fix, the capture list is consumed by the def-parser even when
// it follows a leading colon.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import type { Block, Paragraph, Text } from '@witlang/parser';

function expandSrc(src: string): Block[] {
  const doc = parse(src, '<test>');
  const r = resolve(doc);
  return expand(r).children;
}

function flattenText(blocks: Block[]): string {
  let s = '';
  for (const b of blocks) {
    if (b.kind !== 'paragraph') continue;
    for (const c of (b as Paragraph).children) {
      if (c.kind === 'text') s += (c as Text).value;
    }
  }
  return s;
}

describe('W-1 — single-line def capture list does not leak', () => {
  it('captures after colon get consumed (not emitted as body text)', () => {
    const src = `#cite: ||author, year|| ::author:: (::year::). !!

@cite |author Smith| |year 2024|`;
    const blocks = expandSrc(src);
    const text = flattenText(blocks);
    expect(text).not.toContain('author, year');
    expect(text).toContain('Smith');
    expect(text).toContain('2024');
  });

  it('captures with a single name', () => {
    const src = `#shout: ||what|| ::what::! !!

@shout |what Hello|`;
    const blocks = expandSrc(src);
    const text = flattenText(blocks);
    expect(text).not.toContain('what');
    expect(text).toContain('Hello');
  });
});
