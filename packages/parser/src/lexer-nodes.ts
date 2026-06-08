// Node-use recognizers: NodeOpen (`@name`), NodeClose (`name@`),
// dotted access path (`.y.z`), parens (`(`, `)`), and pipes (`|`).
//
// All recognizers operate on the shared LexState and obey the lexer's
// recognizer contract: return true when consumed, false otherwise.
//
// I.36: handle class is `[A-Za-z0-9_-]`, MUST start with an ASCII letter.
// I.6:  `@name` ends at the first non-handle byte.
// AccessSegment continuation accepts the handle class plus pure-numeric
// segments (`.0` valid).

import { isAsciiLetter, isHandleChar } from './char.js';
import { lexParamState } from './lexer-params.js';
import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { LexState, RunBuf } from './lexer-internals.js';
import type {
  AccessSegment,
  Dot,
  NodeClose,
  NodeOpen,
  ParenOpen,
  PipeOpen,
} from './tokens.js';

// ---------------------------------------------------------------------------
// NodeOpen + access path.
// ---------------------------------------------------------------------------

export function tryNodeOpen(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '@') return false;
  if (!isAsciiLetter(src.charAt(cur.offset + 1))) return false;
  flushTextRun(state, buf);
  emitNodeOpen(state);
  consumeAccessPath(state);
  tryAttachParens(state);
  return true;
}

function emitNodeOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // `@`
  const nameStart = state.cur.offset;
  while (isHandleChar(state.src.charAt(state.cur.offset))) advance(state);
  const name = state.src.slice(nameStart, state.cur.offset);
  const tok: NodeOpen = {
    kind: 'nodeOpen',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function consumeAccessPath(state: LexState): void {
  while (peekDotSegment(state)) emitDotThenSegment(state);
}

function peekDotSegment(state: LexState): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '.') return false;
  return isHandleChar(src.charAt(cur.offset + 1));
}

function emitDotThenSegment(state: LexState): void {
  const dotStart = snapshot(state.cur);
  advance(state);
  const dot: Dot = {
    kind: 'dot',
    loc: locFrom(state.file, dotStart, state.cur),
  };
  state.tokens.push(dot);
  emitSegment(state);
}

function emitSegment(state: LexState): void {
  const start = snapshot(state.cur);
  const nameStart = state.cur.offset;
  while (isHandleChar(state.src.charAt(state.cur.offset))) advance(state);
  const tok: AccessSegment = {
    kind: 'accessSegment',
    name: state.src.slice(nameStart, state.cur.offset),
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function tryAttachParens(state: LexState): void {
  // `@name(...)` form — parens directly adjacent to NodeOpen / AccessSegment.
  if (state.src.charAt(state.cur.offset) !== '(') return;
  emitParenOpen(state);
  lexParamState(state, ')');
}

// ---------------------------------------------------------------------------
// NodeClose (`name@`).
// ---------------------------------------------------------------------------

export function tryNodeClose(state: LexState, buf: RunBuf): boolean {
  if (!isCloseStart(state)) return false;
  const { src, cur } = state;
  let i = cur.offset;
  while (isHandleChar(src.charAt(i))) i += 1;
  if (i === cur.offset) return false;
  if (src.charAt(i) !== '@') return false;
  if (!isAsciiLetter(src.charAt(cur.offset))) return false;
  flushTextRun(state, buf);
  emitNodeClose(state, i);
  return true;
}

function isCloseStart(state: LexState): boolean {
  // A close `name@` only matches when the run starts at a word boundary —
  // preceded by paragraph-start, whitespace, newline, or a non-handle byte.
  const { src, cur, paragraphStart } = state;
  if (cur.offset <= paragraphStart) return true;
  const prev = src.charAt(cur.offset - 1);
  return !isHandleChar(prev);
}

function emitNodeClose(state: LexState, atOffset: number): void {
  const start = snapshot(state.cur);
  const name = state.src.slice(state.cur.offset, atOffset);
  while (state.cur.offset < atOffset) advance(state);
  advance(state); // `@`
  const tok: NodeClose = {
    kind: 'nodeClose',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// Pipe-open: every unescaped `|` enters param state. Parser disambiguates
// mid-prose `|` runs (lean (a), 06-parameters-pipes notes).
// ---------------------------------------------------------------------------

export function tryPipeOpen(state: LexState, buf: RunBuf): boolean {
  if (state.src.charAt(state.cur.offset) !== '|') return false;
  flushTextRun(state, buf);
  emitPipeOpen(state);
  lexParamState(state, '|');
  return true;
}

function emitPipeOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: PipeOpen = {
    kind: 'pipeOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

export function emitParenOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: ParenOpen = {
    kind: 'parenOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}
