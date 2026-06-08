// Lexer driver for Wit source text.
//
// The driver normalizes newlines, walks the cursor, and delegates to
// recognizer helpers for paragraph-level constructs (paragraph breaks,
// comments, emphasis, prose). Comment recognizers live in
// `lexer-recognizers.ts`; shared cursor/state types and helpers live
// in `lexer-internals.ts`.
//
// FUTURE-IMPROVEMENT: CRLF / bare-CR are normalized to LF in a single
// pre-pass; error locations therefore reflect the normalized text.

import { isAsciiDigit, isAsciiLetter } from './char.js';
import {
  tryAdditivePrefix,
  tryBangBang,
  tryBodySlot,
  tryCaptureOpen,
  tryHashClose,
  tryHashOpen,
  tryInterpolation,
} from './lexer-defs.js';
import { tryNodeClose, tryNodeOpen, tryPipeOpen } from './lexer-nodes.js';
import { tryBlockComment, tryLineComment } from './lexer-recognizers.js';
import {
  advance,
  flushTextRun,
  locFrom,
  LexerError,
  snapshot,
} from './lexer-internals.js';
import type { Cursor, LexState, RunBuf } from './lexer-internals.js';
import type {
  EmphasisClose,
  EmphasisOpen,
  EOF,
  ParagraphBreak,
  Token,
} from './tokens.js';

export { LexerError };

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

function consumeParagraphContent(state: LexState): void {
  // Walk a paragraph: recognizers fire on their respective leads;
  // everything else accumulates into a TextRun.
  let buf: RunBuf = { value: '', start: snapshot(state.cur) };
  while (state.cur.offset < state.src.length) {
    if (scanParagraphBreak(state).endOffset !== -1) break;
    if (runRecognizers(state, buf)) { buf = freshBuf(state); continue; }
    buf.value += state.src.charAt(state.cur.offset);
    advance(state);
  }
  flushTextRun(state, buf);
}

function runRecognizers(state: LexState, buf: RunBuf): boolean {
  if (tryBlockComment(state, buf)) return true;
  if (tryLineComment(state, buf)) return true;
  if (tryNodeOpen(state, buf)) return true;
  if (tryNodeClose(state, buf)) return true;
  if (tryAdditivePrefix(state, buf)) return true;
  if (tryHashOpen(state, buf)) return true;
  if (tryHashClose(state, buf)) return true;
  if (tryCaptureOpen(state, buf)) return true;
  if (tryPipeOpen(state, buf)) return true;
  if (tryBangBang(state, buf)) return true;
  if (tryInterpolation(state, buf)) return true;
  if (tryBodySlot(state, buf)) return true;
  if (tryEmphasis(state, buf)) return true;
  return false;
}

function freshBuf(state: LexState): RunBuf {
  return { value: '', start: snapshot(state.cur) };
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

// Re-export cursor helpers' types only — Cursor isn't part of the public
// API but TypeScript needs to see it referenced if a downstream tool
// reads the source map. (No-op at runtime.)
export type { Cursor };
