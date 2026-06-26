// W-20 — backslash escapes are stripped from captured values.
//
// `\,` and `\:` inside a form-fill value are author-side opt-outs
// that prevent the comma / colon from being read as a structural
// separator. After the disambiguation is done the backslash itself
// should NOT appear in the rendered output.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import type { Block, Paragraph, Text } from '@witlang/parser';

function expandSrc(src: string): Block[] {
  const doc = parse(src, '<test>');
  return expand(resolve(doc)).children;
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

describe('W-20 — backslash escapes stripped from captured values', () => {
  it('`\\,` inside a form-fill collection value renders as `,`', () => {
    const src = `#bib_entry ||authors, year||
::authors:: (::year::)
bib_entry#

@bib_entry
  authors: [ Buda\\, M., Maki\\, A. ]
  year: 2018
bib_entry@`;
    const blocks = expandSrc(src);
    const text = flattenText(blocks);
    expect(text).not.toContain('\\,');
    expect(text).toContain('Buda, M.');
    expect(text).toContain('Maki, A.');
  });

  it('`\\:` inside a form-fill value renders as `:`', () => {
    const src = `#x ||val, filler||
::val::
x#

@x
  val: name\\:Tauraj
  filler: f
x@`;
    const blocks = expandSrc(src);
    const text = flattenText(blocks);
    expect(text).not.toContain('\\:');
    expect(text).toContain('name:Tauraj');
  });
});
