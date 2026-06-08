import { describe, it, expect } from 'vitest';

import { lex } from './lexer.js';
import type {
  EmphasisClose,
  EmphasisOpen,
  ParagraphBreak,
  TextRun,
  Token,
} from './tokens.js';

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

describe('lex — emphasis recognizers', () => {
  it('`_word_` -> [emphasisOpen, textRun, emphasisClose, eof]', () => {
    const toks = lex('_word_');
    expect(kinds(toks)).toEqual([
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'eof',
    ]);
    expect((toks[0] as EmphasisOpen).marker).toBe('_');
    expect((toks[1] as TextRun).value).toBe('word');
    expect((toks[2] as EmphasisClose).marker).toBe('_');
  });

  it('`*word*` -> [emphasisOpen, textRun, emphasisClose, eof]', () => {
    const toks = lex('*word*');
    expect(kinds(toks)).toEqual([
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'eof',
    ]);
    expect((toks[0] as EmphasisOpen).marker).toBe('*');
    expect((toks[1] as TextRun).value).toBe('word');
    expect((toks[2] as EmphasisClose).marker).toBe('*');
  });

  it('digit-flanked `*` does not open or close emphasis: `5*6*7`', () => {
    const toks = lex('5*6*7');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('5*6*7');
  });

  it('letter-flanked `_` stays literal: `snake_case_word`', () => {
    const toks = lex('snake_case_word');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('snake_case_word');
  });

  it('empty `__` stays literal (no zero-width emphasis)', () => {
    const toks = lex('__');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('__');
  });

  it('empty `**` stays literal (no zero-width emphasis)', () => {
    const toks = lex('**');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('**');
  });

  it("`_keeper_'s` closes italic before the apostrophe-s tail", () => {
    const toks = lex("_keeper_'s");
    expect(kinds(toks)).toEqual([
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as EmphasisOpen).marker).toBe('_');
    expect((toks[1] as TextRun).value).toBe('keeper');
    expect((toks[2] as EmphasisClose).marker).toBe('_');
    expect((toks[3] as TextRun).value).toBe("'s");
  });

  it('mixed paragraph emits full token stream', () => {
    const toks = lex('He said _hello_ and *bye*.');
    expect(kinds(toks)).toEqual([
      'textRun',
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'textRun',
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as TextRun).value).toBe('He said ');
    expect((toks[1] as EmphasisOpen).marker).toBe('_');
    expect((toks[2] as TextRun).value).toBe('hello');
    expect((toks[3] as EmphasisClose).marker).toBe('_');
    expect((toks[4] as TextRun).value).toBe(' and ');
    expect((toks[5] as EmphasisOpen).marker).toBe('*');
    expect((toks[6] as TextRun).value).toBe('bye');
    expect((toks[7] as EmphasisClose).marker).toBe('*');
    expect((toks[8] as TextRun).value).toBe('.');
  });

  it('emphasis at paragraph start and end', () => {
    const toks = lex('_Alone_, the keeper waited.');
    expect(kinds(toks)).toEqual([
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'textRun',
      'eof',
    ]);
    expect((toks[1] as TextRun).value).toBe('Alone');
    expect((toks[3] as TextRun).value).toBe(', the keeper waited.');
  });

  it('emphasis as the final token of a paragraph', () => {
    const toks = lex('burned until *dawn*');
    expect(kinds(toks)).toEqual([
      'textRun',
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'eof',
    ]);
    expect((toks[2] as TextRun).value).toBe('dawn');
  });

  it('hyphen-adjacent underscore does not open emphasis', () => {
    const toks = lex('foo-_bar');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('foo-_bar');
  });

  it('emphasis loc.length is one byte and tracks column', () => {
    const toks = lex('_x_');
    const open = toks[0] as EmphasisOpen;
    const close = toks[2] as EmphasisClose;
    expect(open.loc.length).toBe(1);
    expect(open.loc.col).toBe(1);
    expect(close.loc.length).toBe(1);
    expect(close.loc.col).toBe(3);
  });

  it('emphasis tokens reset at paragraph boundary', () => {
    const toks = lex('one _word_\n\n*two*');
    expect(kinds(toks)).toEqual([
      'textRun',
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'paragraphBreak',
      'emphasisOpen',
      'textRun',
      'emphasisClose',
      'eof',
    ]);
    expect((toks[5] as EmphasisOpen).marker).toBe('*');
    const pb = toks[4] as ParagraphBreak;
    expect(pb.loc.line).toBe(1);
  });
});

