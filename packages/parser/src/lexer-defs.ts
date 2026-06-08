// Definition-related recognizers: HashOpen (`#name`), HashClose
// (`name#`), AdditivePrefix (`+`), CaptureOpen/Close (`||`), BangBang
// (`!!`), InterpolationOpen/Close (`::`), and BodySlotMarker (`...`).
//
// All recognizers follow the standard contract: return true when they
// consumed bytes and emitted tokens, false otherwise. They mutate the
// shared LexState.
//
// I.36 handle class applies (`[A-Za-z0-9_-]`, must start with a letter)
// for hash-open/close names and interpolation names.

import { isAsciiLetter, isHandleChar } from './char.js';
import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { LexState, RunBuf } from './lexer-internals.js';
import type {
  AdditivePrefix,
  BangBang,
  BodySlotMarker,
  CaptureClose,
  CaptureOpen,
  HashClose,
  HashOpen,
  InterpolationClose,
  InterpolationName,
  InterpolationOpen,
} from './tokens.js';

// ---------------------------------------------------------------------------
// HashOpen `#name`.
// ---------------------------------------------------------------------------

export function tryHashOpen(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '#') return false;
  if (!isAsciiLetter(src.charAt(cur.offset + 1))) return false;
  if (!isAtHandleBoundary(state)) return false;
  flushTextRun(state, buf);
  emitHashOpen(state);
  return true;
}

function isAtHandleBoundary(state: LexState): boolean {
  if (state.cur.offset <= state.paragraphStart) return true;
  const prev = state.src.charAt(state.cur.offset - 1);
  return !isHandleChar(prev);
}

function emitHashOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // `#`
  const nameStart = state.cur.offset;
  while (isHandleChar(state.src.charAt(state.cur.offset))) advance(state);
  const name = state.src.slice(nameStart, state.cur.offset);
  const tok: HashOpen = {
    kind: 'hashOpen',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// HashClose `name#`.
// ---------------------------------------------------------------------------

export function tryHashClose(state: LexState, buf: RunBuf): boolean {
  if (!isAtHandleBoundary(state)) return false;
  const { src, cur } = state;
  if (!isAsciiLetter(src.charAt(cur.offset))) return false;
  let i = cur.offset;
  while (isHandleChar(src.charAt(i))) i += 1;
  if (i === cur.offset) return false;
  if (src.charAt(i) !== '#') return false;
  flushTextRun(state, buf);
  emitHashClose(state, i);
  return true;
}

function emitHashClose(state: LexState, atOffset: number): void {
  const start = snapshot(state.cur);
  const name = state.src.slice(state.cur.offset, atOffset);
  while (state.cur.offset < atOffset) advance(state);
  advance(state); // `#`
  const tok: HashClose = {
    kind: 'hashClose',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// AdditivePrefix `+` (only when immediately followed by `#name`).
// ---------------------------------------------------------------------------

export function tryAdditivePrefix(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '+') return false;
  if (src.charAt(cur.offset + 1) !== '#') return false;
  if (!isAsciiLetter(src.charAt(cur.offset + 2))) return false;
  if (!isAtHandleBoundary(state)) return false;
  flushTextRun(state, buf);
  emitAdditivePrefix(state);
  return true;
}

function emitAdditivePrefix(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // `+`
  const tok: AdditivePrefix = {
    kind: 'additivePrefix',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// BangBang `!!`.
// ---------------------------------------------------------------------------

export function tryBangBang(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '!') return false;
  if (src.charAt(cur.offset + 1) !== '!') return false;
  flushTextRun(state, buf);
  emitBangBang(state);
  return true;
}

function emitBangBang(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  const tok: BangBang = {
    kind: 'bangBang',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// CaptureOpen / CaptureClose `||`.
// ---------------------------------------------------------------------------

export function tryCaptureOpen(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '|') return false;
  if (src.charAt(cur.offset + 1) !== '|') return false;
  flushTextRun(state, buf);
  emitCaptureOpen(state);
  consumeCaptureBody(state);
  return true;
}

function emitCaptureOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  const tok: CaptureOpen = {
    kind: 'captureOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function consumeCaptureBody(state: LexState): void {
  // Inside `||...||` we collect raw bytes; parser splits on `,`. Stop
  // at `||`, newline, or EOF. Empty `||` at EOF emits a synthetic
  // zero-length CaptureClose to keep the token stream balanced.
  if (peekDoublePipe(state)) { emitCaptureClose(state); return; }
  if (state.cur.offset >= state.src.length) { emitCaptureCloseAt(state); return; }
  scanCaptureContent(state);
}

function peekDoublePipe(state: LexState): boolean {
  return state.src.charAt(state.cur.offset) === '|' &&
         state.src.charAt(state.cur.offset + 1) === '|';
}

function scanCaptureContent(state: LexState): void {
  let buf: RunBuf = { value: '', start: snapshot(state.cur) };
  while (state.cur.offset < state.src.length) {
    const c = state.src.charAt(state.cur.offset);
    if (c === '\n') break;
    if (peekDoublePipe(state)) {
      flushTextRun(state, buf);
      emitCaptureClose(state);
      return;
    }
    buf.value += c;
    advance(state);
  }
  flushTextRun(state, buf);
}

function emitCaptureCloseAt(state: LexState): void {
  // Synthetic zero-length close at the current cursor (for empty `||`
  // at end-of-input). Keeps the parser's token stream balanced.
  const start = snapshot(state.cur);
  const tok: CaptureClose = {
    kind: 'captureClose',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitCaptureClose(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  const tok: CaptureClose = {
    kind: 'captureClose',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// Interpolation `::name::`.
// ---------------------------------------------------------------------------

export function tryInterpolation(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== ':') return false;
  if (src.charAt(cur.offset + 1) !== ':') return false;
  if (!isAsciiLetter(src.charAt(cur.offset + 2))) return false;
  const nameEnd = scanInterpolationName(state, cur.offset + 2);
  if (src.charAt(nameEnd) !== ':') return false;
  if (src.charAt(nameEnd + 1) !== ':') return false;
  flushTextRun(state, buf);
  emitInterpolation(state, nameEnd);
  return true;
}

function scanInterpolationName(state: LexState, from: number): number {
  let i = from;
  while (isHandleChar(state.src.charAt(i))) i += 1;
  return i;
}

function emitInterpolation(state: LexState, nameEnd: number): void {
  emitInterpolationOpen(state);
  emitInterpolationNameToken(state, nameEnd);
  emitInterpolationClose(state);
}

function emitInterpolationOpen(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  const tok: InterpolationOpen = {
    kind: 'interpolationOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitInterpolationNameToken(state: LexState, nameEnd: number): void {
  const start = snapshot(state.cur);
  const name = state.src.slice(state.cur.offset, nameEnd);
  while (state.cur.offset < nameEnd) advance(state);
  const tok: InterpolationName = {
    kind: 'interpolationName',
    name,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitInterpolationClose(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  const tok: InterpolationClose = {
    kind: 'interpolationClose',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

// ---------------------------------------------------------------------------
// BodySlotMarker `...` (standalone on a line).
// ---------------------------------------------------------------------------

export function tryBodySlot(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '.') return false;
  if (src.charAt(cur.offset + 1) !== '.') return false;
  if (src.charAt(cur.offset + 2) !== '.') return false;
  if (!isAtHandleBoundary(state)) return false;
  if (isHandleChar(src.charAt(cur.offset + 3))) return false;
  if (src.charAt(cur.offset + 3) === '.') return false;
  flushTextRun(state, buf);
  emitBodySlotMarker(state);
  return true;
}

function emitBodySlotMarker(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  advance(state);
  advance(state);
  const tok: BodySlotMarker = {
    kind: 'bodySlotMarker',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}
