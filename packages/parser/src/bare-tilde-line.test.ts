// W-12b — a bare `~` on its own line is a degenerate empty comment.
//
// Pre-fix, `~` followed immediately by a newline failed the line-comment
// lead match (which required `~ `) and became literal text `"~"` — so
// authors using bare-`~` lines as visual separators inside comment
// blocks saw stray text tokens.

import { describe, expect, it } from 'vitest';
import { lex } from './lexer.js';
import type { Token } from './tokens.js';

function kinds(toks: Token[]): string[] {
  return toks.map((t) => t.kind);
}

describe('W-12b — bare `~` line', () => {
  it('a single bare `~` followed by newline lexes as a lineComment', () => {
    const toks = lex('~\n');
    expect(kinds(toks)).toEqual(['lineComment', 'eof']);
  });

  it('a bare `~` at EOF (no newline) lexes as a lineComment', () => {
    const toks = lex('~');
    expect(kinds(toks)).toEqual(['lineComment', 'eof']);
  });

  it('a comment block with a bare `~` separator emits 4 comments', () => {
    const src = `~ a
~ b
~
~ c`;
    const toks = lex(src);
    expect(kinds(toks).filter((k) => k === 'lineComment')).toHaveLength(4);
  });

  it('`~~` still opens a block comment, not a line comment', () => {
    const toks = lex('~~ a ~~/');
    expect(kinds(toks)).toContain('blockCommentOpen');
  });
});
