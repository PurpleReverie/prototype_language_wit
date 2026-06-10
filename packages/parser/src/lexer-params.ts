// Nested lexer state for param values inside `|...|` or `(...)`.
//
// Inside this state the only structural tokens are:
//   - Comma `,`           (separates positional/named params)
//   - HyphenSeparator `-` (key/value separator — only when surrounded
//                          by spaces; bare hyphens are literal text)
//   - Bang `!`            (flag marker — only at slot-end: immediately
//                          followed by the closer or a comma, optionally
//                          with trailing inline whitespace)
//   - Closer `)` or `|`   (pops the state)
//
// Everything else accumulates into TextRun tokens. I.4 backslash escapes
// (`\|`, `\,`, `\!`, `\\`) inside the state emit the literal char and
// consume the backslash. A line terminator pops the state without
// emitting a closer — parser will diagnose an unclosed slot.

import {
  advance,
  flushTextRun,
  locFrom,
  snapshot,
} from './lexer-internals.js';
import type { LexState, RunBuf } from './lexer-internals.js';
import type {
  Bang,
  Comma,
  HyphenSeparator,
  ParenClose,
  PipeClose,
} from './tokens.js';

type Closer = '|' | ')';

export function lexParamState(state: LexState, closer: Closer): void {
  let buf: RunBuf = freshBuf(state);
  while (state.cur.offset < state.src.length) {
    const c = state.src.charAt(state.cur.offset);
    if (c === '\n') break; // unclosed — parser diagnoses
    if (c === closer) { flushTextRun(state, buf); emitCloser(state, closer); return; }
    if (handleEscape(state, buf)) continue;
    if (handleQuotedString(state, buf)) continue;
    if (handleComma(state, buf, closer)) { buf = freshBuf(state); continue; }
    if (handleHyphen(state, buf, closer)) { buf = freshBuf(state); continue; }
    if (handleColon(state, buf, closer)) { buf = freshBuf(state); continue; }
    if (handleBang(state, buf, closer)) { buf = freshBuf(state); continue; }
    buf.value += c;
    advance(state);
  }
  flushTextRun(state, buf);
}

function freshBuf(state: LexState): RunBuf {
  return { value: '', start: snapshot(state.cur) };
}

function handleEscape(state: LexState, buf: RunBuf): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '\\') return false;
  const next = src.charAt(cur.offset + 1);
  if (!isEscapable(next)) return false;
  advance(state); // consume `\`
  buf.value += next;
  advance(state); // consume escaped char
  return true;
}

function isEscapable(c: string): boolean {
  return c === '|' || c === ',' || c === '!' || c === '\\' ||
         c === ':' || c === '"' || c === '{' || c === '}';
}

function handleQuotedString(state: LexState, buf: RunBuf): boolean {
  // M15.form-fill: `"..."` inside a param slot consumes a literal string
  // value. Inside the quotes only \" and \\ escapes are recognized; other
  // bytes (commas, |, newlines) are content. The quotes ARE preserved in
  // the buf so downstream consumers (parser-params, scriptCall) can see
  // the quoted-string boundary and strip if desired.
  if (state.src.charAt(state.cur.offset) !== '"') return false;
  buf.value += '"';
  advance(state); // opening "
  while (state.cur.offset < state.src.length) {
    const c = state.src.charAt(state.cur.offset);
    if (c === '\\') {
      const next = state.src.charAt(state.cur.offset + 1);
      if (next === '"' || next === '\\') {
        buf.value += '\\' + next; advance(state); advance(state); continue;
      }
    }
    if (c === '"') { buf.value += '"'; advance(state); return true; }
    buf.value += c;
    advance(state);
  }
  return true;
}

function handleColon(state: LexState, buf: RunBuf, _closer: Closer): boolean {
  // M15.form-fill: `:` as key-value separator inside param state. Only
  // fires when the buffer accumulated so far is a single bare identifier
  // (so `href https://example.org` keeps the `://` as content; the space
  // already split key/value).
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== ':') return false;
  if (!isLeadingIdentifier(buf.value)) return false;
  flushTrimmedKey(state, buf);
  emitHyphenSeparator(state);
  return true;
}

function isLeadingIdentifier(s: string): boolean {
  return /^\s*[A-Za-z][A-Za-z0-9_-]*\s*$/.test(s);
}

function handleComma(
  state: LexState,
  buf: RunBuf,
  closer: Closer,
): boolean {
  // Comma is structural only inside parens; inside pipes it's literal.
  if (closer !== ')') return false;
  if (state.src.charAt(state.cur.offset) !== ',') return false;
  flushTextRun(state, buf);
  emitComma(state);
  return true;
}

function handleHyphen(
  state: LexState,
  buf: RunBuf,
  _closer: Closer,
): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '-') return false;
  if (src.charAt(cur.offset + 1) !== ' ') return false;
  if (!buf.value.endsWith(' ')) return false;
  flushTrimmedKey(state, buf);
  emitHyphenSeparator(state);
  return true;
}

function flushTrimmedKey(state: LexState, buf: RunBuf): void {
  // Drop the trailing space the user typed before the separator — it's
  // part of the separator surface, not the key text. Emit a TextRun
  // whose end-loc lands before the spaces.
  const trimmed = buf.value.replace(/ +$/, '');
  const dropped = buf.value.length - trimmed.length;
  if (trimmed.length === 0) return;
  state.tokens.push({
    kind: 'textRun',
    value: trimmed,
    loc: {
      file: state.file,
      line: buf.start.line,
      col: buf.start.col,
      offset: buf.start.offset,
      length: state.cur.offset - dropped - buf.start.offset,
    },
  });
}

function handleBang(
  state: LexState,
  buf: RunBuf,
  closer: Closer,
): boolean {
  const { src, cur } = state;
  if (src.charAt(cur.offset) !== '!') return false;
  if (!isBangAtSlotEnd(state, closer)) return false;
  flushTextRun(state, buf);
  emitBang(state);
  return true;
}

function isBangAtSlotEnd(state: LexState, closer: Closer): boolean {
  // `!` is a Bang flag-marker only when followed (after optional inline
  // whitespace) by the closer or a comma — the param "ends" right after.
  let i = state.cur.offset + 1;
  while (state.src.charAt(i) === ' ' || state.src.charAt(i) === '\t') i += 1;
  const next = state.src.charAt(i);
  if (next === closer) return true;
  if (closer === ')' && next === ',') return true;
  return false;
}

// ---------------------------------------------------------------------------
// Token emitters.
// ---------------------------------------------------------------------------

function emitCloser(state: LexState, closer: Closer): void {
  const start = snapshot(state.cur);
  advance(state);
  if (closer === ')') {
    const tok: ParenClose = {
      kind: 'parenClose',
      loc: locFrom(state.file, start, state.cur),
    };
    state.tokens.push(tok);
  } else {
    const tok: PipeClose = {
      kind: 'pipeClose',
      loc: locFrom(state.file, start, state.cur),
    };
    state.tokens.push(tok);
  }
}

function emitComma(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: Comma = {
    kind: 'comma',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitHyphenSeparator(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: HyphenSeparator = {
    kind: 'hyphenSeparator',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}

function emitBang(state: LexState): void {
  const start = snapshot(state.cur);
  advance(state);
  const tok: Bang = {
    kind: 'bang',
    loc: locFrom(state.file, start, state.cur),
  };
  state.tokens.push(tok);
}
