import { describe, it, expect } from 'vitest';

import { lex, LexerError } from './lexer.js';
import type {
  BlockCommentContent,
  LineComment,
  TextRun,
  Token,
} from './tokens.js';

function kinds(tokens: Token[]): string[] {
  return tokens.map((t) => t.kind);
}

describe('lex — line comments', () => {
  it('line comment at file start', () => {
    const toks = lex('~ remember to verify\nThe lighthouse stood.');
    expect(kinds(toks)).toEqual(['lineComment', 'textRun', 'eof']);
    expect((toks[0] as LineComment).text).toBe('remember to verify');
    expect(toks[0]?.loc.line).toBe(1);
    expect(toks[0]?.loc.col).toBe(1);
    expect((toks[1] as TextRun).value).toBe('\nThe lighthouse stood.');
  });

  it('line comment mid-file between prose lines', () => {
    const toks = lex(
      'The lighthouse was commissioned in 1847.\n~ verify date\nHe served thirty-one years.',
    );
    expect(kinds(toks)).toEqual(['textRun', 'lineComment', 'textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe(
      'The lighthouse was commissioned in 1847.\n',
    );
    expect((toks[1] as LineComment).text).toBe('verify date');
    expect((toks[2] as TextRun).value).toBe('\nHe served thirty-one years.');
  });

  it('line comment after only leading whitespace counts as line-start', () => {
    const toks = lex('  ~ indented note');
    expect(kinds(toks)).toEqual(['textRun', 'lineComment', 'eof']);
    expect((toks[0] as TextRun).value).toBe('  ');
    expect((toks[1] as LineComment).text).toBe('indented note');
  });

  it('`~5 minutes` is literal — no comment', () => {
    const toks = lex('The crossing took ~5 minutes.');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('The crossing took ~5 minutes.');
  });

  it('`x ~ y` mid-line is literal — not a line comment', () => {
    const toks = lex('The estimate, x ~ y, held within tolerance.');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe(
      'The estimate, x ~ y, held within tolerance.',
    );
  });

  it('`~/Documents` is literal — not a line comment', () => {
    const toks = lex('Notes in ~/Documents are private.');
    expect(kinds(toks)).toEqual(['textRun', 'eof']);
    expect((toks[0] as TextRun).value).toBe('Notes in ~/Documents are private.');
  });

  it('line comment value excludes the terminating newline', () => {
    const toks = lex('~ note\n');
    expect(kinds(toks)).toEqual(['lineComment', 'textRun', 'eof']);
    expect((toks[0] as LineComment).text).toBe('note');
    expect(toks[0]?.loc.length).toBe('~ note'.length);
    expect((toks[1] as TextRun).value).toBe('\n');
  });

  it('line comment runs to EOF without a trailing newline', () => {
    const toks = lex('~ trailing');
    expect(kinds(toks)).toEqual(['lineComment', 'eof']);
    expect((toks[0] as LineComment).text).toBe('trailing');
  });
});

describe('lex — block comments', () => {
  it('block comment inline mid-prose', () => {
    const toks = lex('The bell ~~ TODO: confirm year ~~/ rang on the hour.');
    expect(kinds(toks)).toEqual([
      'textRun',
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as TextRun).value).toBe('The bell ');
    expect((toks[2] as BlockCommentContent).text).toBe(' TODO: confirm year ');
    expect((toks[4] as TextRun).value).toBe(' rang on the hour.');
  });

  it('empty block comment `~~ ~~/`', () => {
    const toks = lex('~~ ~~/');
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(' ');
  });

  it('block comment spanning a paragraph break is one comment', () => {
    const src =
      '~~ a longer aside:\n\n   we should decide whether ... ~~/\n\nNext paragraph.';
    const toks = lex(src);
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'paragraphBreak',
      'textRun',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(
      ' a longer aside:\n\n   we should decide whether ... ',
    );
  });

  it('path-safety: `~/Documents` inside a block does not close it', () => {
    const src = '~~ TODO: save to ~/Documents and ~/.bashrc ~~/';
    const toks = lex(src);
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(
      ' TODO: save to ~/Documents and ~/.bashrc ',
    );
  });

  it('internal `~~` (without `/`) is content, not a closer', () => {
    const src = '~~ TODO ~~ also fix the typo on page 3 ~~ and verify ~~/';
    const toks = lex(src);
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(
      ' TODO ~~ also fix the typo on page 3 ~~ and verify ',
    );
  });

  it('closer followed by `.` is NOT a closer (path-safety)', () => {
    const src = '~~ before ~~/.bashrc after ~~/';
    const toks = lex(src);
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(
      ' before ~~/.bashrc after ',
    );
  });

  it('closer at EOF (no char after) is path-safe', () => {
    const toks = lex('~~ x ~~/');
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
    expect((toks[1] as BlockCommentContent).text).toBe(' x ');
  });

  it('block comment loc locations track open and close', () => {
    const toks = lex('~~ x ~~/');
    expect(toks[0]?.loc.col).toBe(1);
    expect(toks[0]?.loc.length).toBe(2);
    expect(toks[2]?.loc.length).toBe(3);
  });

  it('unclosed block comment throws E_UNCLOSED_COMMENT', () => {
    let caught: unknown = null;
    try {
      lex('~~ this never closes');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LexerError);
    const err = caught as LexerError;
    expect(err.code).toBe('E_UNCLOSED_COMMENT');
    expect(err.loc.line).toBe(1);
    expect(err.loc.col).toBe(1);
  });

  it('unclosed block comment that uses `~~/x` (path-shaped) still errors', () => {
    expect(() => lex('~~ todo ~~/Documents')).toThrow(LexerError);
  });

  it('two block comments in one paragraph', () => {
    const toks = lex('a ~~ x ~~/ b ~~ y ~~/ c');
    expect(kinds(toks)).toEqual([
      'textRun',
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'textRun',
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'textRun',
      'eof',
    ]);
    expect((toks[0] as TextRun).value).toBe('a ');
    expect((toks[4] as TextRun).value).toBe(' b ');
    expect((toks[8] as TextRun).value).toBe(' c');
  });

  it('block comment recognition wins over `~ ` line-comment at line start', () => {
    const toks = lex('~~ aside ~~/');
    expect(kinds(toks)).toEqual([
      'blockCommentOpen',
      'blockCommentContent',
      'blockCommentClose',
      'eof',
    ]);
  });
});
