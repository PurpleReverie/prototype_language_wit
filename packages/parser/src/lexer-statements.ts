// Paren-statement recognizers: `(if`, `(else)`, `(end)`, `(each`,
// `as` (the inner `each ... as ...` keyword).
//
// A paren-statement is `(` immediately followed (no internal pad —
// 12-conditionals/_notes lean) by one of the reserved keywords `if`,
// `else`, `end`, `each`. The keyword must end at a word-boundary
// (space or the closing `)`). When recognized, the lexer emits a
// ParenStatementOpen + Keyword token pair, then enters a nested
// statement state that:
//   - emits Keyword for `is`/`equals`/`as` (whole-word).
//   - delegates `@name(.seg)*` to the existing node-open recognizer.
//   - emits ParenClose for the matching `)` and exits.
//   - accumulates everything else into TextRun tokens (the RHS value
//     of a comparison, parsed downstream by parser-statements.ts).
//
// The `(` must sit at a word boundary: start of paragraph, or preceded
// by whitespace / a newline. `(` adjacent to a handle char (e.g. the
// param-form `@name(...)`) is handled by the node-use recognizer in
// lexer-nodes.ts and never reaches this recognizer.

import { isAsciiLetter, isHandleChar } from './char.js';
import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { LexState, RunBuf } from './lexer-internals.js';
import { tryNodeOpen } from './lexer-nodes.js';
import type {
  Keyword,
  KeywordName,
  ParenClose,
  ParenStatementOpen,
} from './tokens.js';

const OPENER_KEYWORDS: readonly KeywordName[] = ['if', 'else', 'end', 'each'];
const INNER_KEYWORDS: readonly KeywordName[] = ['is', 'equals', 'as'];

export function tryParenStatement(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '(') return false;
  if (!isOpenerBoundary(state)) return false;
  const kw = matchOpenerKeyword(src, cur.offset + 1);
  if (kw === null) return false;
  flushTextRun(state, buf);
  emitParenStatementOpen(state);
  emitKeyword(state, kw);
  lexStatementBody(state);
  return true;
}

function isOpenerBoundary(state: LexState): boolean {
  // Paragraph start or preceded by whitespace / newline.
  if (state.cur.offset <= state.paragraphStart) return true;
  const prev = state.src.charAt(state.cur.offset - 1);
  return prev === ' ' || prev === '\t' || prev === '\n';
}

function matchOpenerKeyword(src: string, from: number): KeywordName | null {
  for (const kw of OPENER_KEYWORDS) {
    if (matchesKeywordAt(src, from, kw)) return kw;
  }
  return null;
}

function matchesKeywordAt(src: string, from: number, kw: string): boolean {
  for (let i = 0; i < kw.length; i++) {
    if (src.charAt(from + i) !== kw.charAt(i)) return false;
  }
  const next = src.charAt(from + kw.length);
  return next === ' ' || next === '\t' || next === ')' || next === '';
}

function emitParenStatementOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // `(`
  const tok: ParenStatementOpen = {
    kind: 'parenStatementOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitKeyword(state: LexState, name: KeywordName): void {
  const start = snapshot(state.cur);
  for (let i = 0; i < name.length; i++) advance(state);
  const tok: Keyword = {
    kind: 'keyword',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitParenClose(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: ParenClose = {
    kind: 'parenClose',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// Statement body lexer.
// ---------------------------------------------------------------------------

function lexStatementBody(state: LexState): void {
  let buf: RunBuf = freshBuf(state);
  while (state.cur.offset < state.src.length) {
    const c = state.src.charAt(state.cur.offset);
    if (c === '\n') break;
    if (c === ')') {
      flushTextRun(state, buf);
      emitParenClose(state);
      return;
    }
    if (tryStatementNodeOpen(state, buf)) { buf = freshBuf(state); continue; }
    if (tryInnerKeyword(state, buf)) { buf = freshBuf(state); continue; }
    buf.value += c;
    advance(state);
  }
  flushTextRun(state, buf);
}

function freshBuf(state: LexState): RunBuf {
  return { value: '', start: snapshot(state.cur) };
}

function tryStatementNodeOpen(state: LexState, buf: RunBuf): boolean {
  // Inside a statement, `@name.path` is the canonical access form. The
  // node-open recognizer handles emission and any trailing access path.
  return tryNodeOpen(state, buf);
}

function tryInnerKeyword(state: LexState, buf: RunBuf): boolean {
  if (!isInnerKeywordBoundary(state)) return false;
  const kw = matchInnerKeyword(state);
  if (kw === null) return false;
  flushTextRun(state, buf);
  emitKeyword(state, kw);
  return true;
}

function isInnerKeywordBoundary(state: LexState): boolean {
  // Inner keywords (`is`/`equals`/`as`) must be whole words: preceded by
  // whitespace and followed by whitespace or `)`.
  if (state.cur.offset <= state.paragraphStart) return true;
  const prev = state.src.charAt(state.cur.offset - 1);
  return prev === ' ' || prev === '\t';
}

function matchInnerKeyword(state: LexState): KeywordName | null {
  const { src, cur } = state;
  if (!isAsciiLetter(src.charAt(cur.offset))) return null;
  for (const kw of INNER_KEYWORDS) {
    if (matchesInnerKeywordAt(src, cur.offset, kw)) return kw;
  }
  return null;
}

function matchesInnerKeywordAt(src: string, from: number, kw: string): boolean {
  for (let i = 0; i < kw.length; i++) {
    if (src.charAt(from + i) !== kw.charAt(i)) return false;
  }
  const next = src.charAt(from + kw.length);
  if (isHandleChar(next)) return false;
  return next === ' ' || next === '\t' || next === ')' || next === '';
}
