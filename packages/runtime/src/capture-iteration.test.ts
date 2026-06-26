// W-16: iteration and field access over captured params.
//
// When a captured pipe / form-fill param carries a typed Collection or
// Record value (the parser-side shape probe), the expander pushes it as
// an iteration-env frame before walking the def body. `(each @name as a)
// ... (end)` walks the collection; `@name.field` reads a field.

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

function paragraphTexts(blocks: Block[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.kind !== 'paragraph') continue;
    let s = '';
    for (const c of (b as Paragraph).children) {
      if (c.kind === 'text') s += (c as Text).value;
    }
    out.push(s);
  }
  return out;
}

describe('W-16 — capture iteration / field access', () => {
  it('(each) over a captured collection iterates per item', () => {
    const src = `#fmt ||authors||
(each @authors as a)@a, (end)
fmt#

@fmt |authors [ Smith, Brown ]|`;
    const blocks = expandSrc(src);
    const all = paragraphTexts(blocks).join('|');
    expect(all).toContain('Smith');
    expect(all).toContain('Brown');
    // The raw `[ Smith, Brown ]` should NOT leak verbatim.
    expect(all).not.toContain('[ Smith');
  });

  it('@name.field reads a captured record', () => {
    // `@meta.title` reads field via NodeUse access path; this routes
    // through expandIterRef -> expandDataValue which already walks
    // record fields.
    const src = `#fmt ||meta||
@meta.title
fmt#

@fmt |meta { title - Lighthouses }|`;
    const blocks = expandSrc(src);
    const all = paragraphTexts(blocks).join('|');
    expect(all).toContain('Lighthouses');
  });

  it('form-fill captured collection iterates inside def', () => {
    // Form-fill needs ≥2 content lines per parser-body-forms shape rule;
    // declare both captures so the strict record-arg check passes.
    const src = `#bib ||authors, year||
(each @authors as a)@a, (end)(::year::)
bib#

@bib
  authors: [ Smith, Brown, Jones ]
  year: 2024
bib@`;
    const blocks = expandSrc(src);
    const all = paragraphTexts(blocks).join('|');
    expect(all).toContain('Smith');
    expect(all).toContain('Brown');
    expect(all).toContain('Jones');
  });
});
