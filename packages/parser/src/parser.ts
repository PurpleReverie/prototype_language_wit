// Parser driver for Wit. Given a source string, lexes it into tokens
// and drives a recursive-descent walk over the token stream, producing
// a Document AST node.
//
// Block kinds recognized at the top-level loop:
// - Paragraph (delegates to parser-inline for child Inline[]).
// - Comment (standalone line / block comments between paragraph breaks).
// - NodeUse `@name ...` (block form).
// - NodeDef `#name ...` (block form, single-line, or value-block).
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { lex } from './lexer.js';
import { LexerError } from './lexer-internals.js';
import { parseNodeDef } from './parser-defs.js';
import { ParseError } from './parser-errors.js';
import { TokenCursor } from './parser-cursor.js';
import { parseInline, parseInlineComment } from './parser-inline.js';
import { parseNodeUse } from './parser-nodes.js';
import { parseScriptBlock } from './parser-script.js';
import {
  isStatementStart,
  parseStatementAfterParen,
  type BlockStopFn,
} from './parser-statements.js';
import type {
  Block,
  Comment,
  Document,
  Inline,
  Paragraph,
  ReferenceDirective,
} from './ast.js';
import type { Loc } from './loc.js';
import type { ReferenceDirectiveToken, Token, TokenKind } from './tokens.js';

export { ParseError };

export function parse(source: string, file: string = '<inline>'): Document {
  const tokens = lexOrThrow(source, file);
  const cursor = new TokenCursor(tokens);
  const children: Block[] = [];
  while (!cursor.isAtEnd()) {
    skipParagraphBreaks(cursor);
    if (cursor.isAtEnd()) break;
    const before = cursor.position();
    const block = parseBlock(cursor);
    if (block !== null) children.push(block);
    if (cursor.position() === before) {
      cursor.advance(); // bail safety — never spin on a stuck token.
    }
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
  const tok = cursor.current();
  if (tok.kind === 'referenceDirective') return parseReferenceDirective(cursor);
  if (tok.kind === 'scriptOpen' && isBlockLevelScript(cursor)) {
    return parseScriptBlock(cursor, false);
  }
  if (isDefStart(tok.kind)) return parseDefBlock(cursor);
  if (tok.kind === 'nodeOpen' && isBlockBodiedOpen(cursor)) {
    return parseUseBlock(cursor);
  }
  if (isStatementStart(cursor)) return parseStatementBlock(cursor);
  if (isStandaloneComment(cursor)) return parseStandaloneComment(cursor);
  return parseParagraph(cursor);
}

function isBlockLevelScript(cursor: TokenCursor): boolean {
  // A scriptOpen at the start of a block is a block-level ScriptBlock
  // when nothing follows it on the same paragraph (next non-script
  // tokens are paragraphBreak or EOF). Inline `<% %>` mid-prose is
  // dispatched from parser-inline instead.
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'scriptClose') {
      const after = cursor.peek(i + 1);
      return after.kind === 'paragraphBreak' || after.kind === 'eof';
    }
    if (tok.kind === 'eof' || tok.kind === 'paragraphBreak') return true;
    i += 1;
  }
}

function parseReferenceDirective(cursor: TokenCursor): ReferenceDirective {
  const tok = cursor.advance() as ReferenceDirectiveToken;
  return {
    kind: 'reference',
    path: tok.path,
    loc: tok.loc,
  };
}

function parseStatementBlock(cursor: TokenCursor): Block {
  return parseStatementAfterParen(cursor, { parseBlocks: collectBlocksUntil });
}

function collectBlocksUntil(
  cursor: TokenCursor,
  stop: BlockStopFn,
): Block[] {
  const out: Block[] = [];
  while (!cursor.isAtEnd() && !stop(cursor)) {
    skipParagraphBreaks(cursor);
    if (cursor.isAtEnd() || stop(cursor)) break;
    const before = cursor.position();
    const block = parseBlock(cursor);
    if (block !== null) out.push(block);
    if (cursor.position() === before) break;
  }
  return out;
}

function isBlockBodiedOpen(cursor: TokenCursor): boolean {
  // A NodeOpen at the start of a block is a block-level NodeUse if
  // either a matching `name@` close exists later in the stream, or the
  // open sits alone on its line (next is paragraphBreak/EOF or starts
  // on a later line). The "alone-on-line" case still becomes a block
  // NodeUse here — parseNodeUse then throws E_UNCLOSED_NODE when no
  // close is found.
  const tok = cursor.current();
  if (tok.kind !== 'nodeOpen') return false;
  if (hasMatchingNodeClose(cursor, tok.name)) return true;
  const next = cursor.peek(1);
  if (next.kind === 'paragraphBreak' || next.kind === 'eof') return true;
  if (next.loc.line > tok.loc.line) return true;
  return false;
}

function hasMatchingNodeClose(cursor: TokenCursor, name: string): boolean {
  let i = 1;
  while (true) {
    const t = cursor.peek(i);
    if (t.kind === 'eof') return false;
    if (t.kind === 'nodeClose' && t.name === name) return true;
    i += 1;
  }
}

function isDefStart(kind: TokenKind): boolean {
  return kind === 'hashOpen' || kind === 'additivePrefix';
}

function parseDefBlock(cursor: TokenCursor): Block {
  return parseNodeDef(cursor, {
    parseBlocks: parseDefBlocks,
    parseInline: parseInline,
  });
}

function parseUseBlock(cursor: TokenCursor): Block {
  return parseNodeUse(cursor, {
    inline: false,
    parseBodyInline: parseInline,
    parseBodyBlocks: parseUseBodyBlocks,
  });
}

function parseUseBodyBlocks(
  cursor: TokenCursor,
  stopName: string,
): (Block | Inline)[] {
  return collectBlocksUntilNodeClose(cursor, stopName);
}

function collectBlocksUntilNodeClose(
  cursor: TokenCursor,
  stopName: string,
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  while (!cursor.isAtEnd() && !isMatchingClose(cursor, stopName)) {
    skipParagraphBreaks(cursor);
    if (cursor.isAtEnd() || isMatchingClose(cursor, stopName)) break;
    const before = cursor.position();
    const block = parseBlock(cursor);
    if (block !== null) out.push(block);
    if (cursor.position() === before) break; // no progress — let caller diagnose.
  }
  return out;
}

function isMatchingClose(cursor: TokenCursor, name: string): boolean {
  const tok = cursor.current();
  return tok.kind === 'nodeClose' && tok.name === name;
}

function parseDefBlocks(
  cursor: TokenCursor,
  stopHash: string,
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  while (!cursor.isAtEnd() && !isMatchingHashClose(cursor, stopHash)) {
    skipParagraphBreaks(cursor);
    if (cursor.isAtEnd() || isMatchingHashClose(cursor, stopHash)) break;
    const before = cursor.position();
    const block = parseBlock(cursor);
    if (block !== null) out.push(block);
    if (cursor.position() === before) break;
  }
  return out;
}

function isMatchingHashClose(cursor: TokenCursor, name: string): boolean {
  const tok = cursor.current();
  return tok.kind === 'hashClose' && tok.name === name;
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
