// Param[] parsing for `@name(p, q)` and pipe-form `|key value|`.
//
// Slot grammar (between commas inside parens, or each pipe-pair):
//   - flag:     <text> Bang             → { name: <text>, value: '' }
//   - named-h:  <key> HyphenSeparator <value> → { name: key, value }
//   - named:    <text>                  → { name: first-word, value: rest }
//                                         (when text contains a space)
//   - positional: <text>                → { name: null, value: text }
//                                         (no internal space)
//
// I.4 backslash escapes are applied at the lexer level — text arrives
// already-unescaped.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import type { Param } from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type { Token } from './tokens.js';

// ---------------------------------------------------------------------------
// Public entries.
// ---------------------------------------------------------------------------

export function parseParenParams(cursor: TokenCursor): Param[] {
  // Caller has already consumed ParenOpen. We read slot tokens until
  // ParenClose, splitting on Comma.
  const params: Param[] = [];
  while (!cursor.isAtEnd()) {
    const cur = cursor.current();
    if (cur.kind === 'parenClose') { cursor.advance(); return params; }
    const slot = collectSlotTokens(cursor, /*paren*/ true);
    const p = slotToParam(slot);
    if (p !== null) params.push(p);
    if (cursor.current().kind === 'comma') cursor.advance();
  }
  return params;
}

export function parsePipeParams(cursor: TokenCursor): Param[] {
  // Caller has already consumed PipeOpen. Read until PipeClose; the
  // pipe content is one slot. Multiple consecutive pipe pairs collect
  // via parsePipeRun.
  const slot = collectSlotTokens(cursor, /*paren*/ false);
  if (cursor.current().kind === 'pipeClose') cursor.advance();
  const p = slotToParam(slot);
  return p === null ? [] : [p];
}

export function parsePipeRun(cursor: TokenCursor): Param[] {
  // Consume runs of `|...|` pipe-pairs, optionally separated by whitespace
  // (which arrives as TextRun with only spaces). `||` is tokenized as
  // CaptureOpen/Close by the lexer — in a use-side context it represents
  // an empty pipe-pair, contributing zero params.
  const out: Param[] = [];
  while (canExtendPipeRun(cursor)) {
    skipWhitespaceText(cursor);
    const cur = cursor.current();
    if (cur.kind === 'captureOpen') {
      consumeEmptyPipePair(cursor);
      continue;
    }
    if (cur.kind !== 'pipeOpen') break;
    cursor.advance();
    for (const p of parsePipeParams(cursor)) out.push(p);
  }
  return out;
}

function consumeEmptyPipePair(cursor: TokenCursor): void {
  cursor.advance(); // captureOpen
  if (cursor.current().kind === 'captureClose') cursor.advance();
}

function canExtendPipeRun(cursor: TokenCursor): boolean {
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'pipeOpen') return true;
    if (tok.kind === 'captureOpen') return true;
    if (tok.kind === 'textRun' && /^\s+$/.test(tok.value)) {
      i += 1;
      continue;
    }
    return false;
  }
}

function skipWhitespaceText(cursor: TokenCursor): void {
  while (true) {
    const tok = cursor.current();
    if (tok.kind === 'textRun' && /^\s+$/.test(tok.value)) {
      cursor.advance();
      continue;
    }
    return;
  }
}

// ---------------------------------------------------------------------------
// Slot collection: gather the tokens that compose ONE param value.
// ---------------------------------------------------------------------------

interface SlotTokens {
  text: string;       // pre-hyphen text (for named-multi: the key text)
  hyphen: boolean;
  rest: string;       // post-hyphen text (named-multi value)
  flag: boolean;
  loc: Loc | null;
}

function collectSlotTokens(cursor: TokenCursor, paren: boolean): SlotTokens {
  const slot: SlotTokens = {
    text: '', hyphen: false, rest: '', flag: false, loc: null,
  };
  while (!cursor.isAtEnd() && !isSlotTerminator(cursor.current(), paren)) {
    consumeSlotToken(cursor, slot);
  }
  return slot;
}

function isSlotTerminator(tok: Token, paren: boolean): boolean {
  if (paren) return tok.kind === 'comma' || tok.kind === 'parenClose';
  return tok.kind === 'pipeClose';
}

function consumeSlotToken(cursor: TokenCursor, slot: SlotTokens): void {
  const tok = cursor.advance();
  slot.loc = slot.loc === null ? tok.loc : extendLoc(slot.loc, tok.loc);
  if (tok.kind === 'hyphenSeparator') { slot.hyphen = true; return; }
  if (tok.kind === 'bang') { slot.flag = true; return; }
  if (tok.kind === 'textRun') {
    if (slot.hyphen) slot.rest += tok.value;
    else slot.text += tok.value;
    return;
  }
  // Any other token shouldn't appear inside a param slot (lexer
  // confines this state). Coerce its surface to empty for now.
}

function extendLoc(a: Loc, b: Loc): Loc {
  const aEnd = a.offset + a.length;
  const bEnd = b.offset + b.length;
  const startOffset = Math.min(a.offset, b.offset);
  const endOffset = Math.max(aEnd, bEnd);
  return {
    file: a.file, line: a.line, col: a.col,
    offset: startOffset, length: endOffset - startOffset,
  };
}

// ---------------------------------------------------------------------------
// SlotTokens → Param.
// ---------------------------------------------------------------------------

function slotToParam(slot: SlotTokens): Param | null {
  if (slot.loc === null) return null;
  const left = slot.text.trim();
  const right = slot.rest.trim();
  if (left.length === 0 && right.length === 0 && !slot.flag) return null;
  if (slot.hyphen) return namedFromHyphen(left, right, slot.loc);
  if (slot.flag) return flagParam(left, slot.loc);
  return splitFirstWord(left, slot.loc);
}

function namedFromHyphen(left: string, right: string, loc: Loc): Param {
  return { name: left, value: right, loc };
}

function flagParam(text: string, loc: Loc): Param {
  return { name: text.trim(), value: '', loc };
}

function splitFirstWord(text: string, loc: Loc): Param {
  const m = /^(\S+)\s+(.*)$/.exec(text);
  if (m === null) return { name: null, value: text, loc };
  return { name: m[1], value: m[2], loc };
}
