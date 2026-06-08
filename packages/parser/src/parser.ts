// Parser driver for Wit. Given a source string, lexes it into tokens
// and drives a recursive-descent walk over the token stream, producing
// a Document AST node.
//
// This skeleton recognizes only one block kind: Paragraph. Any token
// other than ParagraphBreak and EOF becomes a Text inline child of the
// current paragraph. Subsequent tasks (M2.parse-prose-emphasis-comments,
// M2.parse-nodes, ...) replace this fallback with real recognizers.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { WitError } from './errors.js';
import { lex } from './lexer.js';
import { LexerError } from './lexer-internals.js';
import { TokenCursor } from './parser-cursor.js';
import type { Block, Document, Inline, Paragraph, Text } from './ast.js';
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
    const block = parseParagraph(cursor);
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

function parseParagraph(cursor: TokenCursor): Paragraph | null {
  const startLoc = cursor.current().loc;
  const inlines: Inline[] = [];
  while (!cursor.isAtEnd() && cursor.current().kind !== 'paragraphBreak') {
    const tok = cursor.advance();
    inlines.push(tokenToText(tok));
  }
  if (inlines.length === 0) return null;
  return {
    kind: 'paragraph',
    children: inlines,
    loc: spanLoc(startLoc, inlines[inlines.length - 1].loc),
  };
}

function tokenToText(tok: Token): Text {
  // Placeholder: every non-break token collapses to a Text inline whose
  // value is the token's textual form (best-effort) and whose loc is the
  // token's loc. Real inline recognizers land in a later task.
  return {
    kind: 'text',
    value: tokenTextValue(tok),
    loc: tok.loc,
  };
}

function tokenTextValue(tok: Token): string {
  if (tok.kind === 'textRun') return tok.value;
  if (tok.kind === 'lineComment') return tok.text;
  if (tok.kind === 'blockCommentContent') return tok.text;
  return '';
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
