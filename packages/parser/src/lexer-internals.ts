// Shared state types and cursor helpers used by the lexer driver and
// its sibling recognizer modules. Splitting these out keeps lexer.ts
// under the file-size cap (RULES 1) while letting recognizers operate
// on the same mutable state.

import { WitError } from './errors.js';
import type { ErrorCodeName } from './errors.js';
import type { Loc } from './loc.js';
import type { TextRun, Token } from './tokens.js';

export class LexerError extends WitError {
  constructor(code: ErrorCodeName, message: string, loc: Loc) {
    super(code, message, loc);
    this.name = 'LexerError';
  }
}

export interface Cursor {
  line: number;
  col: number;
  offset: number;
}

export interface LexState {
  src: string;
  file: string;
  cur: Cursor;
  paragraphStart: number;
  tokens: Token[];
}

export interface RunBuf {
  value: string;
  start: Cursor;
}

export function advance(state: LexState): void {
  const c = state.src.charAt(state.cur.offset);
  state.cur.offset += 1;
  if (c === '\n') {
    state.cur.line += 1;
    state.cur.col = 1;
  } else {
    state.cur.col += 1;
  }
}

export function snapshot(c: Cursor): Cursor {
  return { line: c.line, col: c.col, offset: c.offset };
}

export function locFrom(file: string, start: Cursor, end: Cursor): Loc {
  return {
    file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset - start.offset,
  };
}

export function flushTextRun(state: LexState, buf: RunBuf): void {
  if (buf.value.length === 0) return;
  const tok: TextRun = {
    kind: 'textRun',
    value: buf.value,
    loc: locFrom(state.file, buf.start, state.cur),
  };
  state.tokens.push(tok);
}
