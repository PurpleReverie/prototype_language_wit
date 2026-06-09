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
  // Set true immediately after an inline recognizer (NodeOpen/Close,
  // ScriptOpen/Close, HashOpen/Close, Bang, Interpolation, BodySlot,
  // Pipe/Capture, Emphasis, ParenStatement, etc.) emits its tokens.
  // The next TextRun flush consults this to know whether a leading
  // newline borders inline content (preserve as a single space) or
  // line-level content like a comment (current strip behavior).
  // Cleared by paragraph breaks and by line/block comment recognizers.
  afterInline: boolean;
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

// Two flush sites:
//   - flushTextRun: default. Used by paragraph-boundary and by line/block
//     comment recognizers. Leading/trailing newlines are stripped; the
//     comment / paragraph break already represents the break.
//   - flushTextRunBeforeInline: used by inline recognizers (NodeOpen,
//     ScriptOpen, HashOpen, …) right before they push their own tokens.
//     A trailing newline borders inline content and is preserved as a
//     single space so prose like `at\n@place` doesn't render as `atDunmore`.
//     The recognizer is also responsible for setting `state.afterInline`
//     so the next flush converts a leading newline into a space too.

export function flushTextRun(state: LexState, buf: RunBuf): void {
  emitTextRun(state, buf, normalizeFlush(buf.value, state.afterInline, false));
  state.afterInline = false;
}

export function flushTextRunBeforeInline(state: LexState, buf: RunBuf): void {
  // Trailing newline becomes a space when the next inline marker is an
  // opener that attaches to prose (NodeOpen, ScriptOpen, Interpolation,
  // BodySlot, Emphasis open). Closers (NodeClose, PipeClose) and any
  // marker at paragraph start use the plain flush instead — see callers
  // for the per-recognizer choice.
  emitTextRun(state, buf, normalizeFlush(buf.value, state.afterInline, true));
  state.afterInline = false;
}

// True when the inline recognizer about to fire is mid-line (the buf
// has non-whitespace content after its last newline). A line-leading
// recognizer like `@action\n...` returns false.
export function bufHasMidLineContent(buf: RunBuf): boolean {
  const lastNl = buf.value.lastIndexOf('\n');
  const tail = lastNl === -1 ? buf.value : buf.value.slice(lastNl + 1);
  return /\S/.test(tail);
}

// True when the buf carries any non-whitespace prose anywhere (even on
// a prior line). Drives the trailing-newline → space normalization:
// `lamp at\n@place` needs the trailing `\n` preserved as a space so
// the splice doesn't read `lamp atDunmore`.
export function bufHasAnyContent(buf: RunBuf): boolean {
  return /\S/.test(buf.value);
}

function emitTextRun(state: LexState, buf: RunBuf, stripped: StrippedRun): void {
  if (buf.value.length === 0) return;
  if (stripped.value.length === 0) return;
  const tok: TextRun = {
    kind: 'textRun',
    value: stripped.value,
    loc: shiftedLoc(state, buf.start, stripped.leading, stripped.trailing),
  };
  state.tokens.push(tok);
}

interface StrippedRun {
  value: string;
  leading: number;
  trailing: number;
}

function normalizeFlush(
  value: string, leadingToSpace: boolean, trailingToSpace: boolean,
): StrippedRun {
  let leading = 0;
  while (leading < value.length && value.charAt(leading) === '\n') leading += 1;
  if (leading === value.length) return { value: '', leading, trailing: 0 };
  let trailing = 0;
  while (
    trailing < value.length - leading &&
    value.charAt(value.length - 1 - trailing) === '\n'
  ) trailing += 1;
  const core = value.slice(leading, value.length - trailing);
  const addLeft = leadingToSpace && leading > 0;
  const addRight = trailingToSpace && trailing > 0;
  // When we collapse a run of newlines into a single space, the loc
  // span keeps one source byte for that space (the newline it replaces).
  return {
    value: (addLeft ? ' ' : '') + core + (addRight ? ' ' : ''),
    leading: addLeft ? leading - 1 : leading,
    trailing: addRight ? trailing - 1 : trailing,
  };
}

function shiftedLoc(
  state: LexState,
  start: Cursor,
  leading: number,
  trailing: number,
): Loc {
  const shiftedStart: Cursor = leading === 0
    ? start
    : { line: start.line + leading, col: 1, offset: start.offset + leading };
  const baseLength = state.cur.offset - shiftedStart.offset;
  return {
    file: state.file,
    line: shiftedStart.line,
    col: shiftedStart.col,
    offset: shiftedStart.offset,
    length: baseLength - trailing,
  };
}
