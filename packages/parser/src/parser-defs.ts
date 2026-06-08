// NodeDef parsing.
//
// Three shapes:
//   1. `#name body name#`                                  → 'block'
//   2. `#name: value !!`     (single line, no newline)     → 'single-line'
//   3. `#name: \n value \n !!` (value spans lines)         → 'value-block'
//   4. `+#name ...`          (additive prefix)             → additive: true
//
// Optional capture list `||a, b, c||` follows the hash-open. Body
// content is parsed as a sequence of blocks/inlines using the
// caller-provided helpers (we accept callbacks to avoid a parser.ts
// import cycle).
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { ErrorCode } from './errors.js';
import { ParseError } from './parser-errors.js';
import type {
  Block,
  Inline,
  NodeDef,
} from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type { HashClose, HashOpen, Token } from './tokens.js';

export interface NodeDefOptions {
  parseBlocks: (c: TokenCursor, stopHash: string) => (Block | Inline)[];
  parseInline: (c: TokenCursor) => Inline[];
}

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------

export function parseNodeDef(
  cursor: TokenCursor,
  opts: NodeDefOptions,
): NodeDef {
  const additive = consumeAdditive(cursor);
  const open = cursor.advance() as HashOpen;
  const captures = consumeCaptures(cursor);
  const shape = detectDefShape(cursor, open.name);
  if (shape === 'single-line') {
    return parseSingleLineDef(cursor, open, captures, additive, opts);
  }
  if (shape === 'value-block') {
    return parseValueBlockDef(cursor, open, captures, additive, opts);
  }
  return parseBlockDef(cursor, open, captures, additive, opts);
}

function consumeAdditive(cursor: TokenCursor): boolean {
  if (cursor.current().kind !== 'additivePrefix') return false;
  cursor.advance();
  return true;
}

// ---------------------------------------------------------------------------
// Captures `||a, b, c||`.
// ---------------------------------------------------------------------------

function consumeCaptures(cursor: TokenCursor): string[] {
  const saved = cursor.position();
  skipInlineWhitespace(cursor);
  if (cursor.current().kind !== 'captureOpen') {
    cursor.reset(saved);
    return [];
  }
  cursor.advance();
  const text = readCaptureText(cursor);
  expectCaptureClose(cursor);
  return splitCaptureNames(text);
}

function skipInlineWhitespace(cursor: TokenCursor): void {
  while (true) {
    const tok = cursor.current();
    if (tok.kind !== 'textRun') return;
    if (!/^[ \t]+$/.test(tok.value)) return;
    cursor.advance();
  }
}

function readCaptureText(cursor: TokenCursor): string {
  let text = '';
  while (!cursor.isAtEnd()) {
    const tok = cursor.current();
    if (tok.kind === 'captureClose') break;
    if (tok.kind === 'textRun') text += tok.value;
    cursor.advance();
  }
  return text;
}

function expectCaptureClose(cursor: TokenCursor): void {
  if (cursor.current().kind === 'captureClose') cursor.advance();
}

function splitCaptureNames(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Shape detection.
// ---------------------------------------------------------------------------

type DefShape = 'block' | 'single-line' | 'value-block';

function detectDefShape(cursor: TokenCursor, name: string): DefShape {
  // Scan forward: if a matching `name#` appears before any `!!`, this
  // is a block-form def. Otherwise it's bang-bang-terminated and we
  // distinguish single-line vs value-block by line-spanning.
  const terminator = lookaheadTerminator(cursor, name);
  if (terminator === 'hashClose') return 'block';
  return scansAcrossBreak(cursor) ? 'value-block' : 'single-line';
}

function lookaheadTerminator(
  cursor: TokenCursor,
  name: string,
): 'hashClose' | 'bangBang' | 'eof' {
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return 'eof';
    if (tok.kind === 'hashClose' && tok.name === name) return 'hashClose';
    if (tok.kind === 'bangBang') return 'bangBang';
    i += 1;
  }
}

function scansAcrossBreak(cursor: TokenCursor): boolean {
  // Lookahead: is there a paragraph break OR a multi-line text run
  // before the next BangBang?
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'bangBang') return false;
    if (tok.kind === 'paragraphBreak') return true;
    if (tok.kind === 'eof') return false;
    if (tok.kind === 'textRun' && tok.value.includes('\n')) return true;
    i += 1;
  }
}

// ---------------------------------------------------------------------------
// Single-line `#x: value !!`.
// ---------------------------------------------------------------------------

function parseSingleLineDef(
  cursor: TokenCursor,
  open: HashOpen,
  captures: string[],
  additive: boolean,
  opts: NodeDefOptions,
): NodeDef {
  stripLeadingColon(cursor);
  const body = collectUntilBangBang(cursor, opts);
  const closeLoc = expectBangBang(cursor, open);
  return {
    kind: 'nodeDef',
    name: open.name,
    captures,
    shape: 'single-line',
    body,
    additive,
    loc: spanLoc(open.loc, closeLoc),
  };
}

function parseValueBlockDef(
  cursor: TokenCursor,
  open: HashOpen,
  captures: string[],
  additive: boolean,
  opts: NodeDefOptions,
): NodeDef {
  stripLeadingColon(cursor);
  const body = collectUntilBangBang(cursor, opts);
  const closeLoc = expectBangBang(cursor, open);
  return {
    kind: 'nodeDef',
    name: open.name,
    captures,
    shape: 'value-block',
    body,
    additive,
    loc: spanLoc(open.loc, closeLoc),
  };
}

function stripLeadingColon(cursor: TokenCursor): void {
  const tok = cursor.current();
  if (tok.kind !== 'textRun') return;
  const m = /^[ \t]*:[ \t]*/.exec(tok.value);
  if (m === null) return;
  const remainder = tok.value.slice(m[0].length);
  rewriteCurrentText(cursor, remainder, tok.loc, m[0].length);
}

function rewriteCurrentText(
  cursor: TokenCursor,
  newValue: string,
  oldLoc: Loc,
  stripped: number,
): void {
  // Mutate the current token in place to advance past the colon. The
  // cursor's underlying array is mutable for our purposes (tokens
  // produced fresh by lex()).
  if (newValue.length === 0) { cursor.advance(); return; }
  const tokens = cursorTokens(cursor);
  tokens[cursor.position()] = {
    kind: 'textRun',
    value: newValue,
    loc: shiftLoc(oldLoc, stripped),
  };
}

function shiftLoc(loc: Loc, n: number): Loc {
  return {
    file: loc.file, line: loc.line, col: loc.col + n,
    offset: loc.offset + n, length: loc.length - n,
  };
}

function cursorTokens(cursor: TokenCursor): Token[] {
  // Reach into the cursor for in-place rewrite. Encapsulation-light by
  // design — see parser-cursor.ts comment.
  return (cursor as unknown as { tokens: Token[] }).tokens;
}

function collectUntilBangBang(
  cursor: TokenCursor,
  opts: NodeDefOptions,
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  while (!cursor.isAtEnd() && cursor.current().kind !== 'bangBang') {
    if (cursor.current().kind === 'paragraphBreak') { cursor.advance(); continue; }
    for (const child of opts.parseInline(cursor)) out.push(child);
  }
  return out;
}

function expectBangBang(cursor: TokenCursor, open: HashOpen): Loc {
  const tok = cursor.current();
  if (tok.kind !== 'bangBang') {
    throw new ParseError(
      ErrorCode.E_UNCLOSED_DEFINITION,
      `unclosed #${open.name}: missing !!`,
      open.loc,
    );
  }
  cursor.advance();
  return tok.loc;
}

// ---------------------------------------------------------------------------
// Block `#name body name#`.
// ---------------------------------------------------------------------------

function parseBlockDef(
  cursor: TokenCursor,
  open: HashOpen,
  captures: string[],
  additive: boolean,
  opts: NodeDefOptions,
): NodeDef {
  const body = opts.parseBlocks(cursor, open.name);
  const closeLoc = expectHashClose(cursor, open);
  return {
    kind: 'nodeDef',
    name: open.name,
    captures,
    shape: 'block',
    body,
    additive,
    loc: spanLoc(open.loc, closeLoc),
  };
}

function expectHashClose(cursor: TokenCursor, open: HashOpen): Loc {
  const tok = cursor.current();
  if (tok.kind !== 'hashClose') {
    throw new ParseError(
      ErrorCode.E_UNCLOSED_DEFINITION,
      `unclosed #${open.name}`,
      open.loc,
    );
  }
  const close = tok as HashClose;
  if (close.name !== open.name) {
    throw new ParseError(
      ErrorCode.E_MISMATCHED_CLOSE,
      `expected ${open.name}# but got ${close.name}#`,
      close.loc,
    );
  }
  cursor.advance();
  return close.loc;
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
