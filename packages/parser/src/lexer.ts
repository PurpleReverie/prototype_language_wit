// Lexer driver for Wit source text.
//
// This module is intentionally minimal: it provides the framework
// (cursor, normalization, paragraph-break recognition, TextRun
// fall-through) on which subsequent M2 tasks add real recognizers.
//
// FUTURE-IMPROVEMENT: CRLF / bare-CR are normalized to LF in a
// single pre-pass; error locations therefore reflect the normalized
// text. If round-trip fidelity is needed, add an offset side-map.

import { isAsciiDigit, isAsciiLetter } from './char.js';
import { WitError } from './errors.js';
import type { ErrorCodeName } from './errors.js';
import type { Loc } from './loc.js';
import type {
  EmphasisClose,
  EmphasisOpen,
  EOF,
  ParagraphBreak,
  TextRun,
  Token,
} from './tokens.js';

export class LexerError extends WitError {
  constructor(code: ErrorCodeName, message: string, loc: Loc) {
    super(code, message, loc);
    this.name = 'LexerError';
  }
}

interface Cursor {
  line: number;
  col: number;
  offset: number;
}

interface LexState {
  src: string;
  file: string;
  cur: Cursor;
  paragraphStart: number;
  tokens: Token[];
}

export function lex(source: string, file: string = '<anonymous>'): Token[] {
  const normalized = normalizeNewlines(source);
  const state: LexState = {
    src: normalized,
    file,
    cur: { line: 1, col: 1, offset: 0 },
    paragraphStart: 0,
    tokens: [],
  };
  while (state.cur.offset < state.src.length) {
    step(state);
  }
  state.tokens.push(makeEof(state));
  return state.tokens;
}

function normalizeNewlines(s: string): string {
  // Collapse CRLF and bare CR into LF in one pre-pass.
  return s.replace(/\r\n?/g, '\n');
}

function step(state: LexState): void {
  if (tryParagraphBreak(state)) return;
  consumeParagraphContent(state);
}

interface BreakScan {
  // Last consumed offset (one past the final `\n`) when this position
  // begins a paragraph break, otherwise -1.
  endOffset: number;
}

function scanParagraphBreak(state: LexState): BreakScan {
  // A paragraph break is `\n` followed by zero or more `(ws* \n)` runs,
  // i.e. at least two newlines separated only by inline whitespace.
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '\n') return { endOffset: -1 };
  const lastNewline = scanBreakTail(src, cur.offset + 1);
  if (lastNewline === -1) return { endOffset: -1 };
  return { endOffset: lastNewline + 1 };
}

function scanBreakTail(src: string, from: number): number {
  let i = from;
  let lastNewline = -1;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '\n') { lastNewline = i; i += 1; continue; }
    if (c === ' ' || c === '\t') { i += 1; continue; }
    break;
  }
  return lastNewline;
}

function tryParagraphBreak(state: LexState): boolean {
  const scan = scanParagraphBreak(state);
  if (scan.endOffset === -1) return false;
  emitParagraphBreak(state, scan.endOffset);
  return true;
}

function emitParagraphBreak(state: LexState, endOffset: number): void {
  const start = snapshot(state.cur);
  while (state.cur.offset < endOffset) advance(state);
  const tok: ParagraphBreak = {
    kind: 'paragraphBreak',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
  state.paragraphStart = state.cur.offset;
}

interface RunBuf {
  value: string;
  start: Cursor;
}

function consumeParagraphContent(state: LexState): void {
  // Walk a paragraph emitting EmphasisOpen / EmphasisClose for `_` and `*`
  // where the word-boundary rule fires; everything else accumulates into
  // TextRun bytes flushed at boundaries or paragraph end.
  let buf: RunBuf = { value: '', start: snapshot(state.cur) };
  while (state.cur.offset < state.src.length) {
    if (scanParagraphBreak(state).endOffset !== -1) break;
    if (tryEmphasis(state, buf)) {
      buf = { value: '', start: snapshot(state.cur) };
      continue;
    }
    buf.value += state.src.charAt(state.cur.offset);
    advance(state);
  }
  flushTextRun(state, buf);
}

function flushTextRun(state: LexState, buf: RunBuf): void {
  if (buf.value.length === 0) return;
  const tok: TextRun = {
    kind: 'textRun',
    value: buf.value,
    loc: locFrom(state.file, buf.start, state.cur),
  };
  state.tokens.push(tok);
}

function tryEmphasis(state: LexState, buf: RunBuf): boolean {
  const c = state.src.charAt(state.cur.offset);
  if (c !== '_' && c !== '*') return false;
  const marker = c as '_' | '*';
  if (tryRecognizeEmphasisOpen(state, buf, marker)) return true;
  if (tryRecognizeEmphasisClose(state, buf, marker)) return true;
  return false;
}

function tryRecognizeEmphasisOpen(
  state: LexState,
  buf: RunBuf,
  marker: '_' | '*',
): boolean {
  if (!isPrecedingBoundary(state)) return false;
  if (!isFollowingAlnum(state)) return false;
  flushTextRun(state, buf);
  emitEmphasisOpen(state, marker);
  return true;
}

function tryRecognizeEmphasisClose(
  state: LexState,
  buf: RunBuf,
  marker: '_' | '*',
): boolean {
  if (!isPrecedingAlnum(state)) return false;
  if (!isFollowingBoundary(state)) return false;
  flushTextRun(state, buf);
  emitEmphasisClose(state, marker);
  return true;
}

function emitEmphasisOpen(state: LexState, marker: '_' | '*'): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: EmphasisOpen = {
    kind: 'emphasisOpen',
    marker,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitEmphasisClose(state: LexState, marker: '_' | '*'): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: EmphasisClose = {
    kind: 'emphasisClose',
    marker,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function isAlnum(c: string): boolean {
  return isAsciiLetter(c) || isAsciiDigit(c);
}

function isPrecedingBoundary(state: LexState): boolean {
  // Start-of-paragraph counts as a boundary. Otherwise the previous char
  // must be neither alphanumeric nor `_` nor `-` (per the word-boundary
  // rule's exclusion list).
  if (state.cur.offset <= state.paragraphStart) return true;
  const prev = state.src.charAt(state.cur.offset - 1);
  if (isAlnum(prev)) return false;
  if (prev === '_' || prev === '-') return false;
  return true;
}

function isFollowingBoundary(state: LexState): boolean {
  // End-of-paragraph counts as a boundary; otherwise the next char must
  // not be alphanumeric (non-word per the rule for closing).
  const next = peek(state, 1);
  if (next === '') return true;
  if (next === '\n') return true;
  return !isAlnum(next);
}

function isPrecedingAlnum(state: LexState): boolean {
  if (state.cur.offset <= state.paragraphStart) return false;
  return isAlnum(state.src.charAt(state.cur.offset - 1));
}

function isFollowingAlnum(state: LexState): boolean {
  return isAlnum(peek(state, 1));
}

function peek(state: LexState, ahead: number): string {
  const idx = state.cur.offset + ahead;
  if (idx >= state.src.length) return '';
  return state.src.charAt(idx);
}

function advance(state: LexState): void {
  const c = state.src.charAt(state.cur.offset);
  state.cur.offset += 1;
  if (c === '\n') {
    state.cur.line += 1;
    state.cur.col = 1;
  } else {
    state.cur.col += 1;
  }
}

function snapshot(c: Cursor): Cursor {
  return { line: c.line, col: c.col, offset: c.offset };
}

function locFrom(file: string, start: Cursor, end: Cursor): Loc {
  return {
    file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset - start.offset,
  };
}

function makeEof(state: LexState): EOF {
  return {
    kind: 'eof',
    loc: {
      file: state.file,
      line: state.cur.line,
      col: state.cur.col,
      offset: state.cur.offset,
      length: 0,
    },
  };
}
