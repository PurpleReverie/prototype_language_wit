// Lexer driver for Wit source text.
//
// This module is intentionally minimal: it provides the framework
// (cursor, normalization, paragraph-break recognition, TextRun
// fall-through) on which subsequent M2 tasks add real recognizers.
//
// FUTURE-IMPROVEMENT: CRLF / bare-CR are normalized to LF in a
// single pre-pass; error locations therefore reflect the normalized
// text. If round-trip fidelity is needed, add an offset side-map.

import { WitError } from './errors.js';
import type { ErrorCodeName } from './errors.js';
import type { Loc } from './loc.js';
import type { Token, TextRun, ParagraphBreak, EOF } from './tokens.js';

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
  tokens: Token[];
}

export function lex(source: string, file: string = '<anonymous>'): Token[] {
  const normalized = normalizeNewlines(source);
  const state: LexState = {
    src: normalized,
    file,
    cur: { line: 1, col: 1, offset: 0 },
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
  consumeTextRun(state);
}

function tryParagraphBreak(state: LexState): boolean {
  // A paragraph break is two or more consecutive LFs.
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '\n') return false;
  if (src.charAt(cur.offset + 1) !== '\n') return false;
  emitParagraphBreak(state);
  return true;
}

function emitParagraphBreak(state: LexState): void {
  const start = snapshot(state.cur);
  while (state.src.charAt(state.cur.offset) === '\n') {
    advance(state);
  }
  const tok: ParagraphBreak = {
    kind: 'paragraphBreak',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function consumeTextRun(state: LexState): void {
  // Fall-through recognizer: everything that isn't a paragraph break
  // becomes TextRun bytes until the next paragraph break or EOF.
  const start = snapshot(state.cur);
  let value = '';
  while (state.cur.offset < state.src.length) {
    if (isParagraphBreakAt(state)) break;
    value += state.src.charAt(state.cur.offset);
    advance(state);
  }
  if (value.length === 0) return;
  const tok: TextRun = {
    kind: 'textRun',
    value,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function isParagraphBreakAt(state: LexState): boolean {
  return (
    state.src.charAt(state.cur.offset) === '\n' &&
    state.src.charAt(state.cur.offset + 1) === '\n'
  );
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

