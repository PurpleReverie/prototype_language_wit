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
import { tryReferenceDirective } from './lexer-directives.js';
import { tryNodeClose, tryNodeOpen, tryPipeOpen } from './lexer-nodes.js';
import { tryBlockComment, tryLineComment } from './lexer-recognizers.js';
import { tryScriptBlock } from './lexer-script.js';
import { tryParenStatement } from './lexer-statements.js';
import {
  advance,
  bufHasAnyContent,
  flushTextRun,
  flushTextRunBeforeInline,
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
    afterInline: false,
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
  state.afterInline = false;
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
  if (tryBackslashEscape(state, buf)) return true;
  if (tryBlockComment(state, buf)) return true;
  if (tryLineComment(state, buf)) return true;
  if (tryReferenceDirective(state, buf)) return true;
  if (tryScriptBlock(state, buf)) return true;
  if (tryParenStatement(state, buf)) return true;
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

// M15.form-fill: backslash escape for `\|` in prose context — suppresses
// the pipe-open recognizer so the `|` becomes literal text. Other special
// chars (`:`, `"`, `{`, `}`, `\\`) are handled later (param-state lexer
// inside brackets, or the body post-processor for prose). Leaving the
// backslash + char unchanged in the text run lets the post-processor see
// it (e.g. `name\:Tauraj` must NOT be lifted by the colon-scatter scan).
function tryBackslashEscape(state: LexState, buf: RunBuf): boolean {
  if (state.src.charAt(state.cur.offset) !== '\\') return false;
  const next = state.src.charAt(state.cur.offset + 1);
  if (next !== '|') return false;
  buf.value += next;
  advance(state);
  advance(state);
  return true;
}

function tryEmphasis(state: LexState, buf: RunBuf): boolean {
  const c = state.src.charAt(state.cur.offset);
  if (c !== '_' && c !== '*') return false;
  const marker = c as '_' | '*';
  // W-2 / W-12c: when there's a prior unclosed emphasisOpen of the same
  // marker still pending in the current paragraph AND this position
  // could plausibly close (preceded by non-whitespace not same marker,
  // followed by boundary), prefer CLOSE over OPEN. This unblocks
  // `_::title::_` where the second `_` is followed by punctuation.
  // Without this, the second `_` opens (because punctuation-as-follow
  // passes the W-12c loosened open rule) and the first `_` falls back
  // to literal text.
  if (hasUnclosedEmphasisInParagraph(state, marker) &&
      isPrecedingNonWsNotMarker(state, marker) &&
      isFollowingBoundary(state) &&
      tryRecognizeEmphasisClose(state, buf, marker)) {
    return true;
  }
  if (tryRecognizeEmphasisOpen(state, buf, marker)) return true;
  if (tryRecognizeEmphasisClose(state, buf, marker)) return true;
  return false;
}

// Scan the tokens emitted since the last paragraph break for an
// unmatched emphasisOpen of `marker`. Walks back to the paragraph
// boundary; an emphasisClose seen first (counted as pending) must be
// matched by an emphasisOpen further back. If we encounter an open
// while no close is pending, that open is unmatched and we return true.
function hasUnclosedEmphasisInParagraph(
  state: LexState, marker: '_' | '*',
): boolean {
  let pendingCloses = 0;
  for (let i = state.tokens.length - 1; i >= 0; i--) {
    const t = state.tokens[i]!;
    if (t.kind === 'paragraphBreak') return false;
    if (t.kind === 'emphasisClose' && t.marker === marker) {
      pendingCloses += 1;
    } else if (t.kind === 'emphasisOpen' && t.marker === marker) {
      if (pendingCloses === 0) return true;
      pendingCloses -= 1;
    }
  }
  return false;
}

function tryRecognizeEmphasisOpen(
  state: LexState,
  buf: RunBuf,
  marker: '_' | '*',
): boolean {
  if (!isPrecedingBoundary(state)) return false;
  // W-12c / W-21: open allows following non-whitespace (not just alnum)
  // so `*"foo"*`, `*-flag*` etc. open. The "not same marker" guard
  // keeps `__` / `**` literal (no zero-width emphasis).
  if (!isFollowingNonWsNotMarker(state, marker)) return false;
  if (bufHasAnyContent(buf)) flushTextRunBeforeInline(state, buf);
  else flushTextRun(state, buf);
  emitEmphasisOpen(state, marker);
  return true;
}

function tryRecognizeEmphasisClose(
  state: LexState,
  buf: RunBuf,
  marker: '_' | '*',
): boolean {
  // W-12c / W-21: close allows preceding non-whitespace (not just alnum)
  // so `*Bold.*`, `*Bold!*`, `_Title_)`, and multi-line emphasis (close
  // after a `)` that follows a soft line break) all parse. The "not
  // same marker" guard prevents bare `__` / `**` from spuriously
  // closing in the middle.
  if (!isPrecedingNonWsNotMarker(state, marker)) return false;
  if (!isFollowingBoundary(state)) return false;
  if (bufHasAnyContent(buf)) flushTextRunBeforeInline(state, buf);
  else flushTextRun(state, buf);
  emitEmphasisClose(state, marker);
  // M7.datadef-classify polish: always set afterInline so a following
  // text run's leading newline (`_italic_\nword`) becomes a space, not
  // a strip. The previous guard skipped the flag when newline followed,
  // which caused `<em>italic</em>word` glue.
  state.afterInline = true;
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

// W-12c / W-21: loosened flank rules. "Preceding non-whitespace, not
// the same marker char" — so `.`, `!`, `?`, `,`, `:`, `;`, `)`, `"`
// all count as valid pre-close flanks (fixes the "every emphasised
// lead-in in English prose breaks" report) while `__` / `**` stay
// literal. Symmetric rule for the opening side.
function isPrecedingNonWsNotMarker(state: LexState, marker: '_' | '*'): boolean {
  if (state.cur.offset <= state.paragraphStart) return false;
  const prev = state.src.charAt(state.cur.offset - 1);
  if (prev === '' || prev === ' ' || prev === '\t' || prev === '\n') return false;
  if (prev === marker) return false;
  return true;
}

function isFollowingNonWsNotMarker(state: LexState, marker: '_' | '*'): boolean {
  const next = peek(state, 1);
  if (next === '' || next === ' ' || next === '\t' || next === '\n') return false;
  if (next === marker) return false;
  return true;
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
