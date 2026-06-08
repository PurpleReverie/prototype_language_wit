import { describe, it, expect } from 'vitest';

import { lex } from './lexer.js';
import type { Token, TextRun, ParagraphBreak } from './tokens.js';

function kinds(tokens: Token[]): string[] {
  return tokens.map((t) => t.kind);
}

describe('lex — skeleton behavior', () => {
  it('empty source returns [EOF]', () => {
    const toks = lex('');
    expect(kinds(toks)).toEqual(['eof']);
    expect(toks[0]?.loc.offset).toBe(0);
    expect(toks[0]?.loc.line).toBe(1);
    expect(toks[0]?.loc.col).toBe(1);
  });

  it('single character becomes [textRun, eof]', () => {
    const toks = lex('a');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    const tr = toks[0] as TextRun;
    expect(tr.value).toBe('a');
    expect(tr.loc.length).toBe(1);
    expect(tr.loc.line).toBe(1);
    expect(tr.loc.col).toBe(1);
  });

  it('blank line produces a paragraphBreak token', () => {
    const toks = lex('a\n\nb');
    expect(kinds(toks)).toEqual(['textRun', 'paragraphBreak', 'textRun', 'eof']);
    const pb = toks[1] as ParagraphBreak;
    expect(pb.loc.line).toBe(1);
    // The second textRun starts on line 3.
    expect(toks[2]?.loc.line).toBe(3);
  });

  it('multiple blank lines collapse into one paragraphBreak', () => {
    const toks = lex('a\n\n\n\nb');
    expect(kinds(toks)).toEqual(['textRun', 'paragraphBreak', 'textRun', 'eof']);
  });

  it('single newline stays inside the textRun', () => {
    const toks = lex('a\nb');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    const tr = toks[0] as TextRun;
    expect(tr.value).toBe('a\nb');
  });

  it('CRLF is normalized to LF', () => {
    const toks = lex('a\r\n\r\nb');
    expect(kinds(toks)).toEqual(['textRun', 'paragraphBreak', 'textRun', 'eof']);
  });

  it('bare CR is normalized to LF', () => {
    const toks = lex('a\r\rb');
    expect(kinds(toks)).toEqual(['textRun', 'paragraphBreak', 'textRun', 'eof']);
  });

  it('tracks file name in loc when provided', () => {
    const toks = lex('x', 'foo.wit');
    expect(toks[0]?.loc.file).toBe('foo.wit');
    expect(toks[1]?.loc.file).toBe('foo.wit');
  });

  it('column advances per character on the same line', () => {
    const toks = lex('abc');
    const tr = toks[0] as TextRun;
    expect(tr.value).toBe('abc');
    expect(tr.loc.length).toBe(3);
    expect(toks[1]?.loc.col).toBe(4);
  });
});
