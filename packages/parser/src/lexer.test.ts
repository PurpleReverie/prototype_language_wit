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

describe('lex — prose runs', () => {
  it('"hello" -> [textRun("hello"), eof]', () => {
    const toks = lex('hello');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    const tr = toks[0] as TextRun;
    expect(tr.value).toBe('hello');
    expect(tr.loc.length).toBe(5);
  });

  it('"p1\\n\\np2" -> [textRun, paragraphBreak, textRun, eof]', () => {
    const toks = lex('p1\n\np2');
    expect(kinds(toks)).toEqual([
      'textRun',
      'paragraphBreak',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as TextRun).value).toBe('p1');
    expect((toks[2] as TextRun).value).toBe('p2');
  });

  it('whitespace-only line counts as a paragraph break', () => {
    const toks = lex('p1\n   \t  \np2');
    expect(kinds(toks)).toEqual([
      'textRun',
      'paragraphBreak',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as TextRun).value).toBe('p1');
    expect((toks[2] as TextRun).value).toBe('p2');
    expect(toks[2]?.loc.line).toBe(3);
  });

  it('paragraphBreak.loc.length covers the entire break run', () => {
    const toks = lex('a\n   \nb');
    const pb = toks[1] as ParagraphBreak;
    // Break consumes "\n   \n" — five characters.
    expect(pb.loc.length).toBe(5);
    expect(pb.loc.line).toBe(1);
  });

  it('leading and trailing whitespace stay inside the textRun', () => {
    const toks = lex('   hello   ');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    const tr = toks[0] as TextRun;
    expect(tr.value).toBe('   hello   ');
    expect(tr.loc.length).toBe(11);
    expect(tr.loc.col).toBe(1);
  });

  it('TextRun.loc.length equals byte length of TextRun.value', () => {
    const toks = lex('alpha\nbeta\n\ngamma');
    expect(kinds(toks)).toEqual([
      'textRun',
      'paragraphBreak',
      'textRun',
      'eof',
    ]);
    for (const t of toks) {
      if (t.kind === 'textRun') {
        expect(t.loc.length).toBe(t.value.length);
      }
    }
    expect((toks[0] as TextRun).value).toBe('alpha\nbeta');
  });

  it('single trailing newline stays in the textRun (no phantom break)', () => {
    const toks = lex('hello\n');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('hello\n');
  });

  it('trailing blank lines emit one paragraphBreak then eof', () => {
    const toks = lex('hello\n\n\n');
    expect(kinds(toks)).toEqual(['textRun', 'paragraphBreak', 'eof']);
    expect((toks[0] as TextRun).value).toBe('hello');
  });

  it('multiple paragraphs across consecutive blank lines', () => {
    const toks = lex('one\n\ntwo\n\nthree');
    expect(kinds(toks)).toEqual([
      'textRun',
      'paragraphBreak',
      'textRun',
      'paragraphBreak',
      'textRun',
      'eof',
    ]);
  });

  it('paragraphBreak.loc points to the first blank-line newline', () => {
    const toks = lex('a\n\nb');
    const pb = toks[1] as ParagraphBreak;
    expect(pb.loc.offset).toBe(1);
    expect(pb.loc.line).toBe(1);
    // 'a' is on col 1; first '\n' follows it at col 2.
    expect(pb.loc.col).toBe(2);
  });

  it('soft line break inside paragraph stays in the run', () => {
    const toks = lex('first line\nsecond line\nthird line');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe(
      'first line\nsecond line\nthird line',
    );
  });
});
