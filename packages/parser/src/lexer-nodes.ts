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
  bufHasAnyContent,
  bufHasMidLineContent,
  flushTextRun,
  flushTextRunBeforeInline,
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
  RecordArg,
} from './tokens.js';

// ---------------------------------------------------------------------------
// NodeOpen + access path.
// ---------------------------------------------------------------------------

export function tryNodeOpen(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '@') return false;
  if (!isAsciiLetter(src.charAt(cur.offset + 1))) return false;
  // Peek-ahead: the char immediately after the full @-construct tells
  // us inline-form (prose follows) vs block-form (newline ⇒ body).
  // Only inline-form preserves newlines as spaces around the splice.
  const inline = inlineFormLookahead(src, cur.offset);
  if (inline && bufHasAnyContent(buf)) flushTextRunBeforeInline(state, buf);
  else flushTextRun(state, buf);
  emitNodeOpen(state);
  consumeAccessPath(state);
  tryAttachParens(state);
  tryAttachRecordArg(state);
  if (inline) state.afterInline = true;
  return true;
}

function inlineFormLookahead(src: string, atOffset: number): boolean {
  // Walk past `@name(.seg)*(...)?` without mutating state, then peek
  // the next char. Returns true when that char is NOT a newline (or
  // EOF) — i.e. prose continues on the same line.
  let i = atOffset + 1; // past `@`
  while (isHandleChar(src.charAt(i))) i += 1;
  while (src.charAt(i) === '.' && isHandleChar(src.charAt(i + 1))) {
    i += 1;
    while (isHandleChar(src.charAt(i))) i += 1;
  }
  if (src.charAt(i) === '(') i = scanBalancedParen(src, i);
  // Skip optional whitespace + balanced `{...}` (record-arg form M13).
  let j = i;
  while (src.charAt(j) === ' ' || src.charAt(j) === '\t') j += 1;
  if (src.charAt(j) === '{') i = scanBalancedBrace(src, j);
  const next = src.charAt(i);
  return next !== '\n' && next !== '';
}

function scanBalancedBrace(src: string, openAt: number): number {
  // Skip balanced `{...}` including newlines (records may span lines).
  // Stops at EOF (unclosed; parser diagnoses). Returns position past `}`.
  let i = openAt + 1;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src.charAt(i);
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    i += 1;
  }
  return i;
}

function scanBalancedParen(src: string, openAt: number): number {
  // Skip `(...)` with one level of nesting tolerance. Newlines exit
  // (unclosed paren — parser diagnoses). Returns position past `)`.
  let i = openAt + 1;
  let depth = 1;
  while (i < src.length && depth > 0) {
    const c = src.charAt(i);
    if (c === '\n') return i;
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    i += 1;
  }
  return i;
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

export function tryAttachRecordArg(state: LexState): void {
  // M13.records-as-args: `@name {...}` (optional whitespace before `{`).
  // The scan is balanced on `{`/`}` and tolerates newlines. Called from
  // tryNodeOpen (post-parens) AND from tryPipeOpen (post-pipes) so the
  // mixed case `@x |a 1| {b - 2}` produces both pipe tokens AND a
  // recordArg token, letting the parser raise E_MIXED_PARAM_SOURCE.
  const { src } = state;
  let i = state.cur.offset;
  while (src.charAt(i) === ' ' || src.charAt(i) === '\t') i += 1;
  if (src.charAt(i) !== '{') return;
  const startCur = snapshot(state.cur);
  while (state.cur.offset < i) advance(state);
  const textStart = state.cur.offset;
  let depth = 0;
  while (state.cur.offset < src.length) {
    const c = src.charAt(state.cur.offset);
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    advance(state);
    if (depth === 0) break;
  }
  const text = src.slice(textStart, state.cur.offset);
  const tok: RecordArg = {
    kind: 'recordArg',
    text,
    loc: locFrom(state.file, startCur, state.cur),
  };
  state.tokens.push(tok);
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
  // NodeClose is structural — strip surrounding newlines normally. Use
  // BeforeInline only to absorb a trailing newline when the close sits
  // mid-line right after prose on a prior line; otherwise plain strip
  // suffices and avoids introducing trailing whitespace.
  if (bufHasMidLineContent(buf)) flushTextRunBeforeInline(state, buf);
  else flushTextRun(state, buf);
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
  const inline = pipeInlineLookahead(state.src, state.cur.offset);
  if (inline && bufHasAnyContent(buf)) flushTextRunBeforeInline(state, buf);
  else flushTextRun(state, buf);
  emitPipeOpen(state);
  lexParamState(state, '|');
  // M13: a `{` immediately after a closing pipe (optionally with
  // whitespace) opens a record-arg. The parser raises
  // E_MIXED_PARAM_SOURCE when this combines with the just-emitted
  // pipe params on the same node-use.
  tryAttachRecordArg(state);
  if (inline) state.afterInline = true;
  return true;
}

function pipeInlineLookahead(src: string, atOffset: number): boolean {
  // Pipe-slot is inline-form when prose follows the closing `|` on the
  // same line. Scan past `|...|` (lex-params semantics: stop at `\n`
  // or matching `|`, honoring `\|` escapes), then peek next char.
  let i = atOffset + 1;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === '\n') return false; // unclosed slot — treat as block
    if (c === '\\' && i + 1 < src.length) { i += 2; continue; }
    if (c === '|') break;
    i += 1;
  }
  const next = src.charAt(i + 1);
  return next !== '\n' && next !== '';
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
