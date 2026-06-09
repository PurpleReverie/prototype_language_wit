// Line-start directive recognizer for `reference ./path.wit`.
//
// The directive fires only when:
//   - The cursor sits at the start of a line (offset 0 or the previous
//     character is a newline). Leading inline whitespace is allowed and
//     consumed by the line-start check before this recognizer runs.
//   - The next characters spell `reference` followed by a space or tab.
//   - At least one non-whitespace path character follows.
//
// The path runs verbatim from the character after the space up to (but
// not including) the line-terminating `\n` or EOF. Trailing horizontal
// whitespace on the path is trimmed; internal whitespace is preserved.
//
// `reference` is a SOFT keyword: outside of a line-start position it
// stays in a TextRun. M3.references task brief.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { LexState, RunBuf } from './lexer-internals.js';
import type { ReferenceDirectiveToken } from './tokens.js';

const KEYWORD = 'reference';

export function tryReferenceDirective(
  state: LexState,
  buf: RunBuf,
): boolean {
  if (!atLineStart(state)) return false;
  if (!matchesKeyword(state)) return false;
  const pathInfo = scanPath(state, state.cur.offset + KEYWORD.length + 1);
  if (pathInfo === null) return false;
  flushTextRun(state, buf);
  emitReferenceDirective(state, pathInfo);
  return true;
}

function atLineStart(state: LexState): boolean {
  if (state.cur.offset === 0) return true;
  return state.src.charAt(state.cur.offset - 1) === '\n';
}

function matchesKeyword(state: LexState): boolean {
  const { src, cur } = state;
  for (let i = 0; i < KEYWORD.length; i++) {
    if (src.charAt(cur.offset + i) !== KEYWORD.charAt(i)) return false;
  }
  const after = src.charAt(cur.offset + KEYWORD.length);
  return after === ' ' || after === '\t';
}

interface PathScan {
  path: string;
  endOffset: number; // offset just past the last path character.
}

function scanPath(state: LexState, from: number): PathScan | null {
  const { src } = state;
  let i = from;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c === ' ' || c === '\t') i += 1;
    else break;
  }
  const start = i;
  while (i < src.length && src.charAt(i) !== '\n') i += 1;
  const raw = src.slice(start, i);
  const path = raw.replace(/[ \t]+$/, '');
  if (path.length === 0) return null;
  return { path, endOffset: start + path.length };
}

function emitReferenceDirective(state: LexState, pathInfo: PathScan): void {
  const start = snapshot(state.cur);
  while (state.cur.offset < pathInfo.endOffset) advance(state);
  const tok: ReferenceDirectiveToken = {
    kind: 'referenceDirective',
    path: pathInfo.path,
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}
