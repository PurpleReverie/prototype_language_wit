// W-9 — body slot `...` is not re-substituted inside the use body.
//
// Pre-fix, a literal `...` token inside an invocation body got lexed as
// a bodySlot and then participated in the second pass of body-slot
// substitution, emitting empty text in place of the `...`. Now: any
// bodySlot inside a use body is literalized to Text("...") before
// the def-side substitution runs, so `...` in author prose stays
// content.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import type { Block, Paragraph, Text } from '@witlang/parser';

function expandSrc(src: string): Block[] {
  return expand(resolve(parse(src, '<test>'))).children;
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

describe('W-9 — body slot does not recurse into use body', () => {
  it('literal `...` inside use body renders as `...`', () => {
    const src = `#aside:
  An aside wraps ... and emits the wrapped body verbatim.
!!

@aside The aside wraps this body via the \`...\` slot. aside@`;
    const blocks = expandSrc(src);
    const text = flattenText(blocks);
    expect(text).toContain('via the `...` slot');
  });
});
