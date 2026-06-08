import { describe, expect, it } from 'vitest';

import { lex } from './lexer.js';
import type {
  AccessSegment,
  NodeClose,
  NodeOpen,
  TextRun,
  Token,
} from './tokens.js';

function kinds(tokens: Token[]): string[] {
  return tokens.map((t) => t.kind);
}

describe('lex — node-open / node-close', () => {
  it('emits NodeOpen for bare reference', () => {
    const toks = lex('@weil');
    expect(kinds(toks)).toEqual(['nodeOpen', 'eof']);
    expect((toks[0] as NodeOpen).name).toBe('weil');
    expect(toks[0]?.loc.length).toBe(5);
  });

  it('I.6: @name ends at the first non-handle byte', () => {
    const toks = lex("@weil's");
    expect(kinds(toks)).toEqual(['nodeOpen', 'textRun', 'eof']);
    expect((toks[0] as NodeOpen).name).toBe('weil');
    expect((toks[1] as TextRun).value).toBe("'s");
  });

  it('I.36: lone @ followed by digit is literal text', () => {
    const toks = lex('@5 things');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('@5 things');
  });

  it('I.36: lone @ followed by space is literal text', () => {
    const toks = lex('@ name');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
  });

  it('handles hyphenated and underscored names', () => {
    const a = lex('@paper-stats');
    const b = lex('@chapter_one');
    expect((a[0] as NodeOpen).name).toBe('paper-stats');
    expect((b[0] as NodeOpen).name).toBe('chapter_one');
  });

  it('emits NodeClose for name@', () => {
    const toks = lex('x@');
    expect(kinds(toks)).toEqual(['nodeClose', 'eof']);
    expect((toks[0] as NodeClose).name).toBe('x');
  });

  it('@x x@ tokenizes as open + close', () => {
    const toks = lex('@x x@');
    expect(kinds(toks)).toEqual(['nodeOpen', 'textRun', 'nodeClose', 'eof']);
  });

  it('@x in middle of prose with closer mid-line', () => {
    const toks = lex('She crossed the @highlight last threshold highlight@ alone.');
    expect(kinds(toks)).toContain('nodeOpen');
    expect(kinds(toks)).toContain('nodeClose');
    expect(kinds(toks).filter((k) => k === 'nodeClose')).toHaveLength(1);
  });

  it('bare reference inside prose: @weil, the stranger', () => {
    const toks = lex('The keeper, @weil, the stranger.');
    expect(kinds(toks)).toEqual(['textRun', 'nodeOpen', 'textRun', 'eof']);
  });
});

describe('lex — dotted access path', () => {
  it('@x.y emits NodeOpen + Dot + AccessSegment', () => {
    const toks = lex('@x.y');
    expect(kinds(toks)).toEqual(['nodeOpen', 'dot', 'accessSegment', 'eof']);
    expect((toks[2] as AccessSegment).name).toBe('y');
  });

  it('@x.y.z chains segments', () => {
    const toks = lex('@x.y.z');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'dot', 'accessSegment', 'dot', 'accessSegment', 'eof',
    ]);
  });

  it('numeric segment .0 is allowed', () => {
    const toks = lex('@items.0');
    expect(kinds(toks)).toEqual(['nodeOpen', 'dot', 'accessSegment', 'eof']);
    expect((toks[2] as AccessSegment).name).toBe('0');
  });

  it('trailing dot is literal text after node', () => {
    const toks = lex('@book.');
    expect(kinds(toks)).toEqual(['nodeOpen', 'textRun', 'eof']);
    expect((toks[1] as TextRun).value).toBe('.');
  });

  it('dotted access inside prose: @book.title for ...', () => {
    const toks = lex('The title is @book.title for this edition.');
    expect(kinds(toks)).toEqual([
      'textRun', 'nodeOpen', 'dot', 'accessSegment', 'textRun', 'eof',
    ]);
  });
});
