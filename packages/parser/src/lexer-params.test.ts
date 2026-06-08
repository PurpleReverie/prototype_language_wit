import { describe, expect, it } from 'vitest';

import { lex } from './lexer.js';
import type { TextRun, Token } from './tokens.js';

function kinds(tokens: Token[]): string[] {
  return tokens.map((t) => t.kind);
}

describe('lex — parens (param state)', () => {
  it('empty parens: @x()', () => {
    const toks = lex('@x()');
    expect(kinds(toks)).toEqual(['nodeOpen', 'parenOpen', 'parenClose', 'eof']);
  });

  it('single named param: @badge(tone good)', () => {
    const toks = lex('@badge(tone good)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen', 'textRun', 'parenClose', 'eof',
    ]);
    expect((toks[2] as TextRun).value).toBe('tone good');
  });

  it('multiple positional params with commas', () => {
    const toks = lex('@badge(a, b, c)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen',
      'textRun', 'comma',
      'textRun', 'comma',
      'textRun', 'parenClose', 'eof',
    ]);
  });

  it('trailing comma: @x(a,)', () => {
    const toks = lex('@x(a,)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen', 'textRun', 'comma', 'parenClose', 'eof',
    ]);
  });

  it('inner whitespace preserved: @x( a , b )', () => {
    const toks = lex('@x( a , b )');
    const texts = toks.filter((t) => t.kind === 'textRun') as TextRun[];
    expect(texts.map((t) => t.value)).toEqual([' a ', ' b ']);
  });

  it('flag with bang at slot-end: verified!', () => {
    const toks = lex('@badge(tone good, verified!)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen',
      'textRun', 'comma',
      'textRun', 'bang', 'parenClose', 'eof',
    ]);
  });

  it('hyphen-separator only when surrounded by spaces', () => {
    const toks = lex('@panel(background colour - dark slate)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen',
      'textRun', 'hyphenSeparator', 'textRun',
      'parenClose', 'eof',
    ]);
    const texts = toks.filter((t) => t.kind === 'textRun') as TextRun[];
    expect(texts[0]?.value).toBe('background colour');
    expect(texts[1]?.value).toBe(' dark slate');
  });

  it('backslash escapes special chars inside parens', () => {
    const toks = lex('@x(a\\,b)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen', 'textRun', 'parenClose', 'eof',
    ]);
    expect((toks[2] as TextRun).value).toBe('a,b');
  });
});

describe('lex — pipes (param state)', () => {
  it('basic named pipe: |mood calm|', () => {
    const toks = lex('|mood calm|');
    expect(kinds(toks)).toEqual(['pipeOpen', 'textRun', 'pipeClose', 'eof']);
    expect((toks[1] as TextRun).value).toBe('mood calm');
  });

  it('empty pipe: `||` is tokenized as captureOpen/Close (longest-match)', () => {
    // M2.parse-nodes added `||` as the capture-list delimiter. The
    // parser disambiguates capture-vs-empty-pipe by context.
    const toks = lex('||');
    expect(kinds(toks)).toEqual(['captureOpen', 'captureClose', 'eof']);
  });

  it('flag-with-bang inside pipe: |full width!|', () => {
    const toks = lex('|full width!|');
    expect(kinds(toks)).toEqual([
      'pipeOpen', 'textRun', 'bang', 'pipeClose', 'eof',
    ]);
    expect((toks[1] as TextRun).value).toBe('full width');
  });

  it('literal hyphen inside pipe: |well-known|', () => {
    const toks = lex('|well-known|');
    expect(kinds(toks)).toEqual([
      'pipeOpen', 'textRun', 'pipeClose', 'eof',
    ]);
    expect((toks[1] as TextRun).value).toBe('well-known');
  });

  it('hyphen-separator inside pipe: |key - value|', () => {
    const toks = lex('|key - value|');
    expect(kinds(toks)).toEqual([
      'pipeOpen', 'textRun', 'hyphenSeparator', 'textRun', 'pipeClose', 'eof',
    ]);
  });

  it('comma is literal inside pipes', () => {
    const toks = lex('|a, b|');
    expect(kinds(toks)).toEqual([
      'pipeOpen', 'textRun', 'pipeClose', 'eof',
    ]);
    expect((toks[1] as TextRun).value).toBe('a, b');
  });

  it('backslash escapes pipe char: |a\\|b|', () => {
    const toks = lex('|a\\|b|');
    expect(kinds(toks)).toEqual([
      'pipeOpen', 'textRun', 'pipeClose', 'eof',
    ]);
    expect((toks[1] as TextRun).value).toBe('a|b');
  });

  it('multiple pipe-slots on one line: @x |a x| |b y|', () => {
    const toks = lex('@x |a x| |b y|');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'textRun',
      'pipeOpen', 'textRun', 'pipeClose',
      'textRun',
      'pipeOpen', 'textRun', 'pipeClose',
      'eof',
    ]);
  });

  it('pipe-shaped run in body prose: greedy lex, parser disambiguates', () => {
    // Per 06/_notes.md lean (a), parser treats these as literal mid-prose.
    // The lexer is allowed to emit pipe tokens; pairing is parser's job.
    const toks = lex('red | white | red');
    expect(kinds(toks)).toEqual([
      'textRun', 'pipeOpen', 'textRun', 'pipeClose', 'textRun', 'eof',
    ]);
  });
});

describe('lex — fixture round-trips (categories 04, 05, 06)', () => {
  it('04 dotted-access fixture shape', () => {
    const toks = lex('The title is @book.title for this edition.');
    expect(kinds(toks)).toEqual([
      'textRun', 'nodeOpen', 'dot', 'accessSegment', 'textRun', 'eof',
    ]);
  });

  it('04 block-name-body fixture shape', () => {
    const toks = lex('@aside\nFresnel lenses rarely fail. Keepers do.\naside@');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'textRun', 'nodeClose', 'eof',
    ]);
  });

  it('05 mixed-params fixture shape', () => {
    const toks = lex('@figure(src lamp.png, full width!, caption The lens)');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'parenOpen',
      'textRun', 'comma',
      'textRun', 'bang', 'comma',
      'textRun', 'parenClose', 'eof',
    ]);
  });

  it('06 basic-named fixture shape', () => {
    const toks = lex('@scene |mood calm|\nThe harbour was still.\nscene@');
    expect(kinds(toks)).toEqual([
      'nodeOpen', 'textRun',
      'pipeOpen', 'textRun', 'pipeClose',
      'textRun', 'nodeClose', 'eof',
    ]);
  });
});
