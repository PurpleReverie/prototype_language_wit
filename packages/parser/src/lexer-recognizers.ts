// Comment recognizers extracted from the lexer driver to keep lexer.ts
// under the 350-line file cap (RULES 1). These functions mutate the
// shared LexState through a small recognizer API:
//
//   advance(state)      — bump cursor by one char (handles line/col)
//   snapshot(cur)       — capture cursor for loc start
//   locFrom(file,s,e)   — build a Loc spanning [start, end)
//   flushTextRun(state, buf) — flush pending TextRun bytes
//   isAsciiLetter / isAsciiDigit — char classifications
//
// All recognizers return true when they consumed the construct (and
// emitted tokens), false when the leading characters didn't match.

import { isAsciiDigit, isAsciiLetter } from './char.js';
import { ErrorCode } from './errors.js';
import { LexerError } from './lexer-internals.js';
import type { Cursor, LexState, RunBuf } from './lexer-internals.js';
import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type {
  BlockCommentClose,
  BlockCommentContent,
  BlockCommentOpen,
  LineComment,
} from './tokens.js';

// ---------------------------------------------------------------------------
// Line comments: `~` + ` ` at line start (or after only leading whitespace
// on the current line). Value is everything up to but not including the
// next `\n` (or EOF).
// ---------------------------------------------------------------------------

export function tryLineComment(state: LexState, buf: RunBuf): boolean {
  if (!matchLineCommentLead(state)) return false;
  if (!isAtLineStart(state)) return false;
  flushTextRun(state, buf);
  emitLineComment(state);
  return true;
}

function matchLineCommentLead(state: LexState): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '~') return false;
  const next = src.charAt(cur.offset + 1);
  // Standard `~ ` opener (tilde + space).
  if (next === ' ') return true;
  // W-12b: a bare `~` on its own line (tilde immediately followed by
  // newline or end of file) is a degenerate empty comment, matching
  // the common case of using bare `~` as a visual separator inside a
  // comment block.
  if (next === '\n' || next === '') return true;
  return false;
}

function isAtLineStart(state: LexState): boolean {
  const { src, cur } = state;
  let i = cur.offset - 1;
  while (i >= 0) {
    const c = src.charAt(i);
    if (c === '\n') return true;
    if (c !== ' ' && c !== '\t') return false;
    i -= 1;
  }
  return true;
}

function emitLineComment(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // consume `~`
  // W-12b: only consume the following space if it's actually present.
  // For the degenerate empty-comment case `~\n`, the next char is the
  // newline itself and must not be consumed.
  if (state.src.charAt(state.cur.offset) === ' ') advance(state);
  const textStart = state.cur.offset;
  while (
    state.cur.offset < state.src.length &&
    state.src.charAt(state.cur.offset) !== '\n'
  ) {
    advance(state);
  }
  const text = state.src.slice(textStart, state.cur.offset);
  const tok: LineComment = {
    kind: 'lineComment',
    text,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// Block comments: `~~` opens, `~~/` closes (path-safe: closer must NOT be
// followed by an alphanumeric character or `.`). Internal `~~` without
// the trailing slash is content. May span paragraph breaks. Unclosed at
// EOF raises E_UNCLOSED_COMMENT.
// ---------------------------------------------------------------------------

export function tryBlockComment(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '~') return false;
  if (src.charAt(cur.offset + 1) !== '~') return false;
  // `~~/` at this position is a stray closer, not an opener — leave for
  // higher-level recognizers/parser to diagnose; here we only open when
  // the third char isn't `/`.
  if (src.charAt(cur.offset + 2) === '/') return false;
  flushTextRun(state, buf);
  emitBlockComment(state);
  return true;
}

function emitBlockComment(state: LexState): void {
  const openStart = snapshot(state.cur);
  advance(state); // `~`
  advance(state); // `~`
  emitOpenToken(state, openStart);
  consumeBlockBody(state, openStart);
}

function emitOpenToken(state: LexState, openStart: Cursor): void {
  const tok: BlockCommentOpen = {
    kind: 'blockCommentOpen',
    loc: locFrom(state.file, openStart, state.cur),
  };
  state.tokens.push(tok);
}

function consumeBlockBody(state: LexState, openStart: Cursor): void {
  const bodyStart = snapshot(state.cur);
  while (state.cur.offset < state.src.length) {
    if (isPathSafeCloser(state)) {
      flushContent(state, bodyStart);
      emitCloseToken(state);
      return;
    }
    advance(state);
  }
  throw new LexerError(
    ErrorCode.E_UNCLOSED_COMMENT,
    'Block comment opened with `~~` is not closed with `~~/` before end of input.',
    locFrom(state.file, openStart, state.cur),
  );
}

function isPathSafeCloser(state: LexState): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '~') return false;
  if (src.charAt(cur.offset + 1) !== '~') return false;
  if (src.charAt(cur.offset + 2) !== '/') return false;
  const after = src.charAt(cur.offset + 3);
  if (after === '') return true;
  if (after === '.') return false;
  if (isAsciiLetter(after) || isAsciiDigit(after)) return false;
  return true;
}

function flushContent(state: LexState, bodyStart: Cursor): void {
  if (state.cur.offset === bodyStart.offset) return;
  const text = state.src.slice(bodyStart.offset, state.cur.offset);
  const tok: BlockCommentContent = {
    kind: 'blockCommentContent',
    text,
    loc: locFrom(state.file, bodyStart, state.cur),
  };
  state.tokens.push(tok);
}

function emitCloseToken(state: LexState): void {
  const closeStart = snapshot(state.cur);
  advance(state); // `~`
  advance(state); // `~`
  advance(state); // `/`
  const tok: BlockCommentClose = {
    kind: 'blockCommentClose',
    loc: locFrom(state.file, closeStart, state.cur),
  };
  state.tokens.push(tok);
}
