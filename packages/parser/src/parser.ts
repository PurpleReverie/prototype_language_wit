// Parser driver for Wit. Given a source string, lexes it into tokens
// and drives a recursive-descent walk over the token stream, producing
// a Document AST node.
//
// Block kinds recognized so far:
// - Paragraph: a span of inline content between paragraph breaks.
// - Comment: a LineComment or BlockComment standing alone between
//   paragraph breaks → top-level Comment block (inline=false).
//
// Inline parsing (Text / Italic / Bold / Comment) is delegated to
// parser-inline.ts. NodeUse / NodeDef / scripts / data live in the
// next task (M2.parse-nodes).
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { WitError } from './errors.js';
import { lex } from './lexer.js';
import { LexerError } from './lexer-internals.js';
import { TokenCursor } from './parser-cursor.js';
import { parseInline, parseInlineComment } from './parser-inline.js';
import type {
  Block,
  Comment,
  Document,
  Inline,
  Paragraph,
} from './ast.js';
import type { Loc } from './loc.js';
import type { Token } from './tokens.js';

export class ParseError extends WitError {}

export function parse(source: string, file: string = '<inline>'): Document {
  const tokens = lexOrThrow(source, file);
  const cursor = new TokenCursor(tokens);
  const children: Block[] = [];
  while (!cursor.isAtEnd()) {
    skipParagraphBreaks(cursor);
    if (cursor.isAtEnd()) break;
    const block = parseBlock(cursor);
    if (block !== null) children.push(block);
  }
  return makeDocument(children, source, file);
}

function lexOrThrow(source: string, file: string): Token[] {
  try {
    return lex(source, file);
  } catch (err) {
    if (err instanceof LexerError) {
      throw new ParseError(err.code, err.message, err.loc);
    }
    throw err;
  }
}

function skipParagraphBreaks(cursor: TokenCursor): void {
  while (cursor.match('paragraphBreak') !== null) {
    // consume runs of paragraph breaks between blocks.
  }
}

function parseBlock(cursor: TokenCursor): Block | null {
  if (isStandaloneComment(cursor)) return parseStandaloneComment(cursor);
  return parseParagraph(cursor);
}

function isStandaloneComment(cursor: TokenCursor): boolean {
  const tok = cursor.current();
  if (tok.kind !== 'lineComment' && tok.kind !== 'blockCommentOpen') {
    return false;
  }
  return commentRunEndsParagraph(cursor);
}

function commentRunEndsParagraph(cursor: TokenCursor): boolean {
  // A comment is "standalone" when nothing follows it on the same
  // paragraph: peek past the comment's full token span and check that
  // the next non-comment token is a paragraph break or EOF.
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'lineComment') {
      i += 1;
      continue;
    }
    if (tok.kind === 'blockCommentOpen') {
      i = skipBlockCommentTokens(cursor, i);
      continue;
    }
    return tok.kind === 'paragraphBreak' || tok.kind === 'eof';
  }
}

function skipBlockCommentTokens(cursor: TokenCursor, fromIdx: number): number {
  let i = fromIdx + 1;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'blockCommentContent') {
      i += 1;
      continue;
    }
    if (tok.kind === 'blockCommentClose') return i + 1;
    return i;
  }
}

function parseStandaloneComment(cursor: TokenCursor): Comment {
  const node = parseInlineComment(cursor);
  return { ...node, inline: false };
}

function parseParagraph(cursor: TokenCursor): Paragraph | null {
  const startLoc = cursor.current().loc;
  const inlines: Inline[] = parseInline(cursor);
  if (inlines.length === 0) return null;
  return {
    kind: 'paragraph',
    children: inlines,
    loc: spanLoc(startLoc, inlines[inlines.length - 1].loc),
  };
}

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset + end.length - start.offset,
  };
}

function makeDocument(
  children: Block[],
  source: string,
  file: string,
): Document {
  return {
    kind: 'document',
    children,
    loc: documentLoc(source, file),
  };
}

function documentLoc(source: string, file: string): Loc {
  return {
    file,
    line: 1,
    col: 1,
    offset: 0,
    length: source.length,
  };
}
