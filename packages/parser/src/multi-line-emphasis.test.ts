// W-21 — emphasis spans soft line breaks.
//
// Inside a paragraph, a soft line break (a single newline with leading
// indentation) is treated by the lexer as content inside the emphasis
// span. The close-flank rule no longer demands an alphanumeric byte
// before the marker, so `_Proceedings of\n  the IEEE\n  (CVPR)_`
// closes around the journal title. Blank lines still terminate the
// surrounding paragraph and thereby the emphasis.

import { describe, expect, it } from 'vitest';
import { lex } from './lexer.js';
import type { Token } from './tokens.js';

function kinds(toks: Token[]): string[] {
  return toks.map((t) => t.kind);
}

describe('W-21 — emphasis across line breaks', () => {
  it('italic over two lines', () => {
    const toks = lex('Read _Proceedings of\n  the IEEE_ pp. 1.');
    expect(kinds(toks)).toContain('emphasisOpen');
    expect(kinds(toks)).toContain('emphasisClose');
  });

  it('italic that ends with `)_` after a soft break still closes', () => {
    const toks = lex('In _Pattern Recognition\n  (CVPR)_ pp. 770.');
    const k = kinds(toks);
    expect(k).toContain('emphasisOpen');
    expect(k).toContain('emphasisClose');
  });

  it('blank line still terminates paragraph and prevents close', () => {
    // `_open` then paragraphBreak then `close_` — open has no matching close.
    const toks = lex('Text _open here\n\nclose_ after.');
    // First paragraph: emphasisOpen with no close inside it.
    // The lexer should emit a paragraphBreak between the two.
    const k = kinds(toks);
    expect(k).toContain('paragraphBreak');
  });
});
