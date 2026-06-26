// W-12c — emphasis with trailing punctuation should close.
//
// The pre-fix close rule required the preceding character to be
// alphanumeric, which broke `*Bold.*`, `*Bold!*`, `*Bold?*`, etc.
// — every common English lead-in phrase. The rule is now "preceding
// non-whitespace and not the same marker", so any punctuation that
// follows a word character pre-close lets the marker close.

import { describe, expect, it } from 'vitest';
import { lex } from './lexer.js';
import type { Token } from './tokens.js';

function kinds(toks: Token[]): string[] {
  return toks.map((t) => t.kind);
}

describe('W-12c — emphasis closes after trailing punctuation', () => {
  for (const ch of ['.', '!', '?', ',', ':', ';', ')']) {
    it(`*Bold${ch}* closes around 'Bold${ch}'`, () => {
      const toks = lex(`*Bold${ch}*`);
      expect(kinds(toks)).toEqual([
        'emphasisOpen',
        'textRun',
        'emphasisClose',
        'eof',
      ]);
    });
    it(`_Italic${ch}_ closes around 'Italic${ch}'`, () => {
      const toks = lex(`_Italic${ch}_`);
      expect(kinds(toks)).toEqual([
        'emphasisOpen',
        'textRun',
        'emphasisClose',
        'eof',
      ]);
    });
  }

  it('mid-paragraph `*Bold.* text after` keeps the trailing text', () => {
    const toks = lex('*Bold.* and more');
    expect(kinds(toks)).toEqual([
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'textRun',
      'eof',
    ]);
  });
});
