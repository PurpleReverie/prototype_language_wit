// NodeDef parsing. Shapes: 'block' (`#x body x#`), 'single-line'
// (`#x: value !!`), 'value-block' (`#x:\n...\n!!`); `+#x` is additive.
// Optional capture list `||a, b, c||` follows the hash-open. Body is
// parsed via caller-provided helpers to avoid a parser.ts import cycle.

import { ErrorCode } from './errors.js';
import {
  formFillToRecord,
  isFormFillRawText,
} from './parser-body-forms.js';
import { resolveCaptures, type CaptureList } from './parser-captures.js';
import {
  maybeAsDataValue,
  tryParseCollectionFromText,
  tryParseRecordFromText,
} from './parser-data.js';
import { ParseError } from './parser-errors.js';
import type {
  Block, Collection as CollectionNode, DataDef, Inline, NodeDef,
  Record as RecordNode,
} from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type { HashClose, HashOpen, Token } from './tokens.js';

export interface NodeDefOptions {
  parseBlocks: (c: TokenCursor, stopHash: string) => (Block | Inline)[];
  parseInline: (c: TokenCursor) => Inline[];
}

// ---------------------------------------------------------------------------
// Entry.
// ---------------------------------------------------------------------------

export function parseNodeDef(
  cursor: TokenCursor,
  opts: NodeDefOptions,
): NodeDef | DataDef {
  const additive = consumeAdditive(cursor);
  const open = cursor.advance() as HashOpen;
  let captures = consumeCaptures(cursor);
  const shape = detectDefShape(cursor, open.name);
  // W-1: single-line / value-block defs can write `#name: ||a, b|| body !!`
  // — the capture list comes AFTER the leading colon. consumeCaptures
  // already ran with the colon in the way, so try again past it.
  if (captures === null && shape !== 'block') {
    captures = consumeCapturesAfterColon(cursor);
  }
  if (shape === 'single-line') {
    return parseSingleLineDef(cursor, open, captures, additive, opts);
  }
  if (shape === 'value-block') {
    return parseValueBlockDef(cursor, open, captures, additive, opts);
  }
  return parseBlockDef(cursor, open, captures, additive, opts);
}

// W-1: a single-line / value-block def can place its capture list after
// the leading colon: `#name: ||a, b|| body !!`. Peek past the colon
// text-run and try consumeCaptures there. On match, rewrite the leading
// colon token so the body parser sees only the post-colon, post-captures
// remainder.
function consumeCapturesAfterColon(cursor: TokenCursor): CaptureList {
  const saved = cursor.position();
  const tok = cursor.current();
  if (tok.kind !== 'textRun') return null;
  const m = /^[ \t]*:[ \t]*/.exec(tok.value);
  if (m === null) return null;
  const afterColon = tok.value.slice(m[0].length);
  // Need the post-colon residue to be empty (the captures are the next
  // token) before we advance past the colon.
  if (afterColon.length > 0) return null;
  cursor.advance(); // consume the colon text-run
  if (cursor.current().kind !== 'captureOpen') {
    cursor.reset(saved);
    return null;
  }
  cursor.advance();
  const text = readCaptureText(cursor);
  expectCaptureClose(cursor);
  return splitCaptureNames(text);
}


function consumeAdditive(cursor: TokenCursor): boolean {
  if (cursor.current().kind !== 'additivePrefix') return false;
  cursor.advance();
  return true;
}

// ---------------------------------------------------------------------------
// Captures `||a, b, c||`.
// ---------------------------------------------------------------------------

function consumeCaptures(cursor: TokenCursor): CaptureList {
  const saved = cursor.position();
  skipInlineWhitespace(cursor);
  if (cursor.current().kind !== 'captureOpen') {
    cursor.reset(saved);
    return null;
  }
  cursor.advance();
  const text = readCaptureText(cursor);
  expectCaptureClose(cursor);
  return splitCaptureNames(text);
}

function skipInlineWhitespace(cursor: TokenCursor): void {
  while (true) {
    const tok = cursor.current();
    if (tok.kind !== 'textRun') return;
    if (!/^[ \t]+$/.test(tok.value)) return;
    cursor.advance();
  }
}

function readCaptureText(cursor: TokenCursor): string {
  let text = '';
  while (!cursor.isAtEnd()) {
    const tok = cursor.current();
    if (tok.kind === 'captureClose') break;
    if (tok.kind === 'textRun') text += tok.value;
    cursor.advance();
  }
  return text;
}

function expectCaptureClose(cursor: TokenCursor): void {
  if (cursor.current().kind === 'captureClose') cursor.advance();
}

function splitCaptureNames(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Shape detection.
// ---------------------------------------------------------------------------

type DefShape = 'block' | 'single-line' | 'value-block';

function detectDefShape(cursor: TokenCursor, name: string): DefShape {
  // `name#` before `!!` ⇒ block. Otherwise `!!` over a line break ⇒
  // value-block; same-line or absent `!!` ⇒ single-line (rule (b)).
  const terminator = lookaheadTerminator(cursor, name);
  if (terminator === 'hashClose') return 'block';
  if (terminator === 'bangBang' && scansAcrossBreak(cursor)) return 'value-block';
  return 'single-line';
}

function lookaheadTerminator(
  cursor: TokenCursor, name: string,
): 'hashClose' | 'bangBang' | 'eof' {
  // Subsequent def-start (`#x`, `+#x`) is a hard boundary.
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return 'eof';
    if (tok.kind === 'hashClose' && tok.name === name) return 'hashClose';
    if (tok.kind === 'bangBang') return 'bangBang';
    if (i > 0 && (tok.kind === 'hashOpen' || tok.kind === 'additivePrefix')) {
      return 'eof';
    }
    i += 1;
  }
}

function scansAcrossBreak(cursor: TokenCursor): boolean {
  // Paragraph break OR multi-line text before next BangBang? Stops at next def.
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'bangBang') return false;
    if (tok.kind === 'paragraphBreak') return true;
    if (tok.kind === 'eof') return false;
    if (i > 0 && (tok.kind === 'hashOpen' || tok.kind === 'additivePrefix')) {
      return false;
    }
    if (tok.kind === 'textRun' && tok.value.includes('\n')) return true;
    i += 1;
  }
}

// ---------------------------------------------------------------------------
// Single-line `#x: value !!`.
// ---------------------------------------------------------------------------

function parseSingleLineDef(
  cursor: TokenCursor, open: HashOpen, captures: CaptureList,
  additive: boolean, opts: NodeDefOptions,
): NodeDef | DataDef {
  return parseBangBangDef(cursor, open, captures, additive, opts, 'single-line');
}

function parseValueBlockDef(
  cursor: TokenCursor, open: HashOpen, captures: CaptureList,
  additive: boolean, opts: NodeDefOptions,
): NodeDef {
  return parseBangBangDef(cursor, open, captures, additive, opts, 'value-block') as NodeDef;
}

function parseBangBangDef(
  cursor: TokenCursor, open: HashOpen, captures: CaptureList,
  additive: boolean, opts: NodeDefOptions,
  shape: 'single-line' | 'value-block',
): NodeDef | DataDef {
  stripLeadingColon(cursor);
  // M15 form-fill bypass (value-block only): probe the raw source span
  // between the colon and the matching `!!` before parsing. See
  // parser-nodes.ts peekRawBody for rationale.
  const rawValBlock = shape === 'value-block'
    ? peekRawBangBangBody(cursor, open) : null;
  const fastFillRec = rawValBlock !== null && !additive && captures === null &&
    isFormFillRawText(rawValBlock)
    ? formFillToRecord(rawValBlock, open.loc) : null;
  // W-19: raw-text probe for `#name: [ ... ] !!` / `#name: { ... } !!`
  // BEFORE the inline parser runs. Applies to both single-line and
  // value-block shapes — a multi-line collection literal `[\n  { ... }\n]`
  // classifies as value-block due to the newline. Without this probe,
  // a `_x_` inside a collection / record value gets parsed as italic
  // and splits the body's single Text node — silently downgrading
  // what should be a dataDef(value=collection) into a nodeDef.
  const rawForData = rawValBlock ?? (shape === 'single-line'
    ? peekRawBangBangBody(cursor, open) : null);
  const rawDataValue = rawForData !== null && !additive && captures === null
    ? probeRawDataValue(rawForData, open.loc) : null;
  const raw = shape === 'single-line'
    ? collectSingleLineValue(cursor, opts) : collectValueBlock(cursor, opts);
  const trimmed = shape === 'single-line' ? trimTrailingTextWs(raw) : raw;
  const body: (Block | Inline | RecordNode | CollectionNode)[] =
    shape === 'single-line' ? maybeAsDataValue(trimmed) : trimmed;
  const closeLoc = expectBangBang(cursor, open);
  const loc = spanLoc(open.loc, closeLoc);
  if (rawDataValue !== null) {
    return { kind: 'dataDef', name: open.name, value: rawDataValue, loc };
  }
  if (shape === 'single-line' && !additive) {
    const dataValue = extractPureDataValue(body);
    if (dataValue !== null) {
      return { kind: 'dataDef', name: open.name, value: dataValue, loc };
    }
  }
  if (fastFillRec !== null) {
    return { kind: 'dataDef', name: open.name, value: fastFillRec, loc };
  }
  return {
    kind: 'nodeDef', name: open.name,
    captures: resolveCaptures(captures, body),
    shape, body, additive, loc,
  };
}

// W-19: probe the raw single-line body text for `[ … ]` / `{ … }`. If the
// whole body (after trimming whitespace and the trailing `!!`) is a
// well-formed collection or record literal, return it. Underscores or
// asterisks inside the values stay as content; no inline emphasis runs.
// Parse errors from the data parser are absorbed (return null) so the
// regular inline-parsing path kicks in for genuine non-literal bodies.
function probeRawDataValue(
  rawBody: string,
  loc: Loc,
): RecordNode | CollectionNode | null {
  const text = rawBody.replace(/[ \t\n]+$/, '');
  if (text.length === 0) return null;
  if (text.charAt(0) !== '[' && text.charAt(0) !== '{') return null;
  try {
    if (text.charAt(0) === '[') {
      const c = tryParseCollectionFromText(text, loc);
      if (c === null || text.slice(c.endPos).trim().length !== 0) return null;
      return c.collection;
    }
    const r = tryParseRecordFromText(text, loc);
    if (r === null || text.slice(r.endPos).trim().length !== 0) return null;
    return r.record;
  } catch {
    return null;
  }
}

// Peek raw source between the value-block opener and its closing `!!`
// without consuming tokens. Stops at the next def-start as well — those
// are implicit terminators that don't carry a raw body. The returned
// substring has the leading `:` and inline whitespace stripped (those
// are the value-block opener punctuation, not body content), so form-
// fill detection sees the first real content line.
function peekRawBangBangBody(
  cursor: TokenCursor, open: HashOpen,
): string | null {
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return null;
    if (i > 0 && (tok.kind === 'hashOpen' || tok.kind === 'additivePrefix')) {
      return null;
    }
    if (tok.kind === 'bangBang') {
      const start = open.loc.offset + open.loc.length;
      const end = tok.loc.offset;
      const raw = cursor.sliceSource(start, end);
      return raw.replace(/^[ \t]*:[ \t]*/, '');
    }
    i += 1;
  }
}

// A single-line def whose body collapsed to exactly a Record or
// Collection (no surrounding text) is data, not a node template.
function extractPureDataValue(
  body: (Block | Inline | RecordNode | CollectionNode)[],
): RecordNode | CollectionNode | null {
  if (body.length !== 1) return null;
  const only = body[0]!;
  if (only.kind === 'record' || only.kind === 'collection') return only;
  return null;
}

// Trim trailing whitespace from the last Text node in a single-line def
// body (M7.fix-whitespace) so `@year` splices `1923` not `1923 `.
function trimTrailingTextWs(body: (Block | Inline)[]): (Block | Inline)[] {
  if (body.length === 0) return body;
  const last = body[body.length - 1];
  if (last === undefined || last.kind !== 'text') return body;
  const trimmed = last.value.replace(/[ \t\n]+$/, '');
  if (trimmed === last.value) return body;
  if (trimmed.length === 0) return body.slice(0, -1);
  const newLast = { ...last, value: trimmed,
    loc: { ...last.loc, length: last.loc.length - (last.value.length - trimmed.length) } };
  return [...body.slice(0, -1), newLast];
}

function stripLeadingColon(cursor: TokenCursor): void {
  const tok = cursor.current();
  if (tok.kind !== 'textRun') return;
  const m = /^[ \t]*:[ \t]*/.exec(tok.value);
  if (m === null) return;
  const remainder = tok.value.slice(m[0].length);
  rewriteCurrentText(cursor, remainder, tok.loc, m[0].length);
}

function rewriteCurrentText(
  cursor: TokenCursor, newValue: string, oldLoc: Loc, stripped: number,
): void {
  // Mutate current token in place to advance past the colon.
  if (newValue.length === 0) { cursor.advance(); return; }
  const tokens = cursorTokens(cursor);
  tokens[cursor.position()] = {
    kind: 'textRun', value: newValue, loc: shiftLoc(oldLoc, stripped),
  };
}

function shiftLoc(loc: Loc, n: number): Loc {
  return {
    file: loc.file, line: loc.line, col: loc.col + n,
    offset: loc.offset + n, length: loc.length - n,
  };
}

function cursorTokens(cursor: TokenCursor): Token[] {
  // Reach into cursor for in-place rewrite. See parser-cursor.ts.
  return (cursor as unknown as { tokens: Token[] }).tokens;
}

function collectSingleLineValue(
  cursor: TokenCursor, opts: NodeDefOptions,
): (Block | Inline)[] {
  // Terminated by `!!`, next def start, paragraph break, or EOF.
  return collectDefValue(cursor, opts, true);
}

function collectValueBlock(
  cursor: TokenCursor, opts: NodeDefOptions,
): (Block | Inline)[] {
  // Spans paragraph breaks; ends only at `!!`, next def start, or EOF.
  return collectDefValue(cursor, opts, false);
}

function collectDefValue(
  cursor: TokenCursor, opts: NodeDefOptions, stopAtParaBreak: boolean,
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  while (!cursor.isAtEnd() && !isDefValueTerminator(cursor, stopAtParaBreak)) {
    if (!stopAtParaBreak && cursor.current().kind === 'paragraphBreak') {
      cursor.advance(); continue;
    }
    const before = cursor.position();
    for (const child of opts.parseInline(cursor)) out.push(child);
    if (cursor.position() === before) break; // forward-progress safety.
  }
  return out;
}

function isDefValueTerminator(
  cursor: TokenCursor, stopAtParaBreak: boolean,
): boolean {
  const k = cursor.current().kind;
  if (k === 'bangBang' || k === 'hashOpen' || k === 'additivePrefix') return true;
  return stopAtParaBreak && k === 'paragraphBreak';
}

function expectBangBang(cursor: TokenCursor, open: HashOpen): Loc {
  const tok = cursor.current();
  if (tok.kind === 'bangBang') {
    cursor.advance();
    return tok.loc;
  }
  if (isImplicitDefTerminator(tok.kind)) return open.loc;
  throw new ParseError(
    ErrorCode.E_UNCLOSED_DEFINITION,
    `unclosed #${open.name}: missing !!`,
    open.loc,
  );
}

function isImplicitDefTerminator(kind: string): boolean {
  return kind === 'hashOpen' ||
         kind === 'additivePrefix' ||
         kind === 'eof' ||
         kind === 'paragraphBreak';
}

// ---------------------------------------------------------------------------
// Block `#name body name#`.
// ---------------------------------------------------------------------------

function parseBlockDef(
  cursor: TokenCursor, open: HashOpen, captures: CaptureList,
  additive: boolean, opts: NodeDefOptions,
): NodeDef | DataDef {
  // M15 form-fill bypass (mirrors parser-nodes.ts): probe the raw source
  // span between the hash-open and its matching `name#` close before
  // invoking the body parser. Form-fill bodies are parsed line-shaped
  // off the raw text so emphasis markers survive in values.
  const rawBody = peekRawHashBody(cursor, open);
  const fastFillRec = rawBody !== null && !additive && captures === null &&
    isFormFillRawText(rawBody)
    ? formFillToRecord(rawBody, open.loc) : null;
  const body = opts.parseBlocks(cursor, open.name);
  const closeLoc = expectHashClose(cursor, open);
  const loc = spanLoc(open.loc, closeLoc);
  if (fastFillRec !== null) {
    return { kind: 'dataDef', name: open.name, value: fastFillRec, loc };
  }
  return {
    kind: 'nodeDef', name: open.name,
    captures: resolveCaptures(captures, body),
    shape: 'block', body, additive, loc,
  };
}

// Peek the raw source substring between `#name` opener and matching
// `name#` closer without consuming any tokens. Returns null when there's
// no matching close in scope (the caller still proceeds to parse and
// surface a normal unclosed-definition diagnostic).
function peekRawHashBody(cursor: TokenCursor, open: HashOpen): string | null {
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return null;
    if (tok.kind === 'hashClose' && tok.name === open.name) {
      const start = open.loc.offset + open.loc.length;
      const end = tok.loc.offset;
      return cursor.sliceSource(start, end);
    }
    i += 1;
  }
}

function expectHashClose(cursor: TokenCursor, open: HashOpen): Loc {
  const tok = cursor.current();
  if (tok.kind !== 'hashClose') {
    throw new ParseError(
      ErrorCode.E_UNCLOSED_DEFINITION, `unclosed #${open.name}`, open.loc,
    );
  }
  const close = tok as HashClose;
  if (close.name !== open.name) {
    throw new ParseError(
      ErrorCode.E_MISMATCHED_CLOSE,
      `expected ${open.name}# but got ${close.name}#`, close.loc,
    );
  }
  cursor.advance();
  return close.loc;
}

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file, line: start.line, col: start.col,
    offset: start.offset, length: end.offset + end.length - start.offset,
  };
}
