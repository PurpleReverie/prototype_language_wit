// Script-block lexer for `<% ... %>`.
//
// When the cursor sits at `<%`, this recognizer:
//   - flushes any pending TextRun,
//   - emits a ScriptOpen token,
//   - scans forward byte-by-byte until the first `%>` or EOF,
//   - emits ScriptBlockContent for the opaque payload (if any),
//   - emits ScriptClose for the matching `%>`.
//
// If no `%>` is found before EOF, raises E_UNCLOSED_SCRIPT pointing at
// the `<%` open. Contents between markers are opaque — no Wit tokens
// are emitted inside. The parser later distinguishes block vs inline
// usage from its block-context (parser.ts vs parser-inline.ts).
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { ErrorCode } from './errors.js';
import {
  advance,
  flushTextRun,
  LexerError,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { Cursor, LexState, RunBuf } from './lexer-internals.js';
import type {
  ScriptBlockContent,
  ScriptClose,
  ScriptOpen,
} from './tokens.js';

export function tryScriptBlock(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '<') return false;
  if (src.charAt(cur.offset + 1) !== '%') return false;
  flushTextRun(state, buf);
  const openStart = snapshot(cur);
  emitScriptOpen(state, openStart);
  const contentStart = snapshot(state.cur);
  const closeAt = findScriptClose(state.src, state.cur.offset);
  if (closeAt === -1) throwUnclosed(state, openStart);
  emitContent(state, contentStart, closeAt);
  emitScriptClose(state);
  return true;
}

function emitScriptOpen(state: LexState, start: Cursor): void {
  advance(state); // `<`
  advance(state); // `%`
  const tok: ScriptOpen = {
    kind: 'scriptOpen',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function findScriptClose(src: string, from: number): number {
  let i = from;
  while (i < src.length - 1) {
    if (src.charAt(i) === '%' && src.charAt(i + 1) === '>') return i;
    i += 1;
  }
  return -1;
}

function emitContent(state: LexState, start: Cursor, closeAt: number): void {
  if (closeAt === start.offset) return;
  const text = state.src.slice(start.offset, closeAt);
  while (state.cur.offset < closeAt) advance(state);
  const tok: ScriptBlockContent = {
    kind: 'scriptBlockContent',
    text,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitScriptClose(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state); // `%`
  advance(state); // `>`
  const tok: ScriptClose = {
    kind: 'scriptClose',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function throwUnclosed(state: LexState, openStart: Cursor): never {
  throw new LexerError(
    ErrorCode.E_UNCLOSED_SCRIPT,
    'unclosed <% script block',
    locFrom(state.file, openStart, state.cur),
  );
}
