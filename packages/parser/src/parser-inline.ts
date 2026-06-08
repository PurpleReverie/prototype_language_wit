// Inline parsing helpers for the Wit parser.
//
// Consumes the inline tokens emitted by the lexer (TextRun,
// EmphasisOpen/Close, LineComment, BlockCommentOpen/Content/Close) and
// produces an Inline[] suitable for a Paragraph's children. Out of
// scope: NodeUse, ScriptCall, Interpolation, BodySlot (M2.parse-nodes).
//
// Emphasis handling:
// - Treat marks as nestable when properly balanced. An EmphasisOpen with
//   no matching EmphasisClose (same marker) before the paragraph
//   boundary falls back to literal text (the `_` or `*` byte) and the
//   inner content is re-parsed as inline.
// - Nested `_*x*_` yields Italic { children: [Bold { children: [Text] }] }.
//
// Comment handling:
// - Inline LineComment / BlockComment tokens become Comment inline nodes
//   (`inline: true`). Standalone-vs-inline disambiguation happens in
//   parser.ts at the block level.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { parseNodeUse } from './parser-nodes.js';
import type {
  Bold,
  BodySlot,
  Comment,
  Inline,
  Interpolation,
  Italic,
  NodeUse,
  Text,
} from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type {
  BlockCommentClose,
  BlockCommentContent,
  BlockCommentOpen,
  BodySlotMarker,
  EmphasisClose,
  EmphasisOpen,
  InterpolationClose,
  InterpolationName,
  InterpolationOpen,
  LineComment,
  TextRun,
  Token,
} from './tokens.js';

// ---------------------------------------------------------------------------
// Public entry.
// ---------------------------------------------------------------------------

export function parseInline(cursor: TokenCursor): Inline[] {
  const out: Inline[] = [];
  while (!cursor.isAtEnd() && !isParagraphBoundary(cursor.current())) {
    const inline = parseOneInline(cursor);
    if (inline === null) break;
    out.push(inline);
  }
  return out;
}

function isParagraphBoundary(tok: Token): boolean {
  return tok.kind === 'paragraphBreak' || tok.kind === 'eof';
}

function parseOneInline(cursor: TokenCursor): Inline | null {
  const tok = cursor.current();
  if (tok.kind === 'textRun') return takeText(cursor);
  if (tok.kind === 'emphasisOpen') return takeEmphasisOrLiteral(cursor);
  if (tok.kind === 'emphasisClose') return literalEmphasis(cursor);
  if (tok.kind === 'lineComment') return takeLineComment(cursor);
  if (tok.kind === 'blockCommentOpen') return takeBlockComment(cursor);
  if (tok.kind === 'blockCommentContent') return contentAsText(cursor);
  if (tok.kind === 'blockCommentClose') return closerAsText(cursor);
  if (tok.kind === 'nodeOpen') return takeInlineNodeUse(cursor);
  if (tok.kind === 'nodeClose') return null;
  if (tok.kind === 'hashClose') return null;
  if (tok.kind === 'bangBang') return null;
  if (tok.kind === 'interpolationOpen') return takeInterpolation(cursor);
  if (tok.kind === 'bodySlotMarker') return takeBodySlot(cursor);
  return fallbackText(cursor);
}

function takeInlineNodeUse(cursor: TokenCursor): NodeUse {
  return parseNodeUse(cursor, {
    inline: true,
    parseBodyInline: parseInline,
    parseBodyBlocks: () => [],
  });
}

function takeInterpolation(cursor: TokenCursor): Interpolation {
  const open = cursor.advance() as InterpolationOpen;
  const nameTok = consumeInterpolationName(cursor);
  const close = consumeInterpolationClose(cursor, open.loc);
  return {
    kind: 'interpolation',
    name: nameTok?.name ?? '',
    loc: spanLoc(open.loc, close),
  };
}

function consumeInterpolationName(
  cursor: TokenCursor,
): InterpolationName | null {
  const tok = cursor.current();
  if (tok.kind !== 'interpolationName') return null;
  cursor.advance();
  return tok as InterpolationName;
}

function consumeInterpolationClose(cursor: TokenCursor, fallback: Loc): Loc {
  const tok = cursor.current();
  if (tok.kind === 'interpolationClose') {
    cursor.advance();
    return (tok as InterpolationClose).loc;
  }
  return fallback;
}

function takeBodySlot(cursor: TokenCursor): BodySlot {
  const tok = cursor.advance() as BodySlotMarker;
  return { kind: 'bodySlot', loc: tok.loc };
}

// ---------------------------------------------------------------------------
// Text / fallback handlers.
// ---------------------------------------------------------------------------

function takeText(cursor: TokenCursor): Text {
  const tok = cursor.advance() as TextRun;
  return { kind: 'text', value: tok.value, loc: tok.loc };
}

function literalEmphasis(cursor: TokenCursor): Text {
  // EmphasisClose with no matching open — render as literal byte.
  const tok = cursor.advance() as EmphasisClose;
  return { kind: 'text', value: tok.marker, loc: tok.loc };
}

function fallbackText(cursor: TokenCursor): Text {
  // Unknown inline token (e.g. NodeOpen, ParenOpen) — emit best-effort
  // Text so the parser remains total. Real handling lands in
  // M2.parse-nodes.
  const tok = cursor.advance();
  return { kind: 'text', value: tokenSourceText(tok), loc: tok.loc };
}

function tokenSourceText(tok: Token): string {
  if (tok.kind === 'textRun') return tok.value;
  if (tok.kind === 'lineComment') return tok.text;
  if (tok.kind === 'blockCommentContent') return tok.text;
  return '';
}

// ---------------------------------------------------------------------------
// Emphasis.
// ---------------------------------------------------------------------------

export function parseEmphasis(cursor: TokenCursor): Italic | Bold | null {
  const open = cursor.current();
  if (open.kind !== 'emphasisOpen') return null;
  const saved = cursor.position();
  cursor.advance();
  const children = parseEmphasisChildren(cursor, open.marker);
  if (children === null) {
    rewind(cursor, saved);
    return null;
  }
  const close = cursor.advance() as EmphasisClose;
  return makeEmphasisNode(open, close, children);
}

function parseEmphasisChildren(
  cursor: TokenCursor,
  marker: '_' | '*',
): Inline[] | null {
  const children: Inline[] = [];
  while (!cursor.isAtEnd() && !isParagraphBoundary(cursor.current())) {
    const tok = cursor.current();
    if (tok.kind === 'emphasisClose' && tok.marker === marker) return children;
    const child = parseOneInline(cursor);
    if (child === null) return null;
    children.push(child);
  }
  return null;
}

function takeEmphasisOrLiteral(cursor: TokenCursor): Inline {
  const open = cursor.current() as EmphasisOpen;
  const node = parseEmphasis(cursor);
  if (node !== null) return node;
  cursor.advance();
  return { kind: 'text', value: open.marker, loc: open.loc };
}

function makeEmphasisNode(
  open: EmphasisOpen,
  close: EmphasisClose,
  children: Inline[],
): Italic | Bold {
  const loc = spanLoc(open.loc, close.loc);
  if (open.marker === '_') {
    return { kind: 'italic', children, loc };
  }
  return { kind: 'bold', children, loc };
}

function rewind(cursor: TokenCursor, idx: number): void {
  cursor.reset(idx);
}

// ---------------------------------------------------------------------------
// Comments.
// ---------------------------------------------------------------------------

export function parseInlineComment(cursor: TokenCursor): Comment {
  const tok = cursor.current();
  if (tok.kind === 'lineComment') return takeLineComment(cursor);
  return takeBlockComment(cursor);
}

function takeLineComment(cursor: TokenCursor): Comment {
  const tok = cursor.advance() as LineComment;
  return { kind: 'comment', text: tok.text, inline: true, loc: tok.loc };
}

function takeBlockComment(cursor: TokenCursor): Comment {
  const open = cursor.advance() as BlockCommentOpen;
  const text = consumeBlockBody(cursor);
  const closeLoc = consumeBlockClose(cursor, open.loc);
  return {
    kind: 'comment',
    text,
    inline: true,
    loc: spanLoc(open.loc, closeLoc),
  };
}

function consumeBlockBody(cursor: TokenCursor): string {
  let text = '';
  while (!cursor.isAtEnd()) {
    const tok = cursor.current();
    if (tok.kind === 'blockCommentContent') {
      cursor.advance();
      text += (tok as BlockCommentContent).text;
      continue;
    }
    return text;
  }
  return text;
}

function consumeBlockClose(cursor: TokenCursor, openLoc: Loc): Loc {
  const tok = cursor.current();
  if (tok.kind === 'blockCommentClose') {
    cursor.advance();
    return (tok as BlockCommentClose).loc;
  }
  // Unclosed at parser level should not happen (lexer raises first), but
  // be defensive — fall back to the open's loc.
  return openLoc;
}

function contentAsText(cursor: TokenCursor): Text {
  // Stray BlockCommentContent without a preceding open — render literal.
  const tok = cursor.advance() as BlockCommentContent;
  return { kind: 'text', value: tok.text, loc: tok.loc };
}

function closerAsText(cursor: TokenCursor): Text {
  // Stray BlockCommentClose token — render literal `~~/`.
  const tok = cursor.advance() as BlockCommentClose;
  return { kind: 'text', value: '~~/', loc: tok.loc };
}

// ---------------------------------------------------------------------------
// Loc helpers.
// ---------------------------------------------------------------------------

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset + end.length - start.offset,
  };
}
