// W-13 — inline use of a block-form def does not split the surrounding
// paragraph.
//
// The canonical citation pattern is `#cite ||a, y||\n::a:: (::y::)\ncite#`,
// which is a block-form def. The same def is naturally invoked inline
// inside prose: `... (@cite |a X| |y 2024| cite@) ...`. Pre-fix, the
// def's Paragraph body got hoisted to a top-level block, splitting the
// outer paragraph into three. Post-fix, the def's content splices as
// inlines so the outer paragraph stays one cohesive run.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import type { Block, Paragraph, Text } from '@witlang/parser';

function expandSrc(src: string): Block[] {
  const doc = parse(src, '<test>');
  const resolved = resolve(doc);
  return expand(resolved).children;
}

function paragraphText(p: Paragraph): string {
  let s = '';
  for (const c of p.children) if (c.kind === 'text') s += (c as Text).value;
  return s;
}

describe('W-13 — inline use of block-form def', () => {
  it('keeps the surrounding paragraph as a single block', () => {
    const src = `#cite ||author, year||
::author:: (::year::)
cite#

Inline use here (@cite |author X| |year 2024| cite@) inside a sentence.`;
    const blocks = expandSrc(src);
    const paras = blocks.filter((b) => b.kind === 'paragraph') as Paragraph[];
    expect(paras).toHaveLength(1);
    const text = paragraphText(paras[0]!);
    expect(text).toContain('Inline use here');
    expect(text).toContain('X');
    expect(text).toContain('2024');
    expect(text).toContain('inside a sentence');
  });
});
