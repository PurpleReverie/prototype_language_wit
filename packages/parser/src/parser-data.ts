// Record / DataValue parsing from raw text.
//
// Records (`{ key - value, key - value }`) currently arrive at the parser
// as a single TextRun inside a single-line def body. Rather than adding a
// dedicated record-state lexer mode (which would have to disambiguate
// `{` mid-prose from `{` as record opener), this module parses the brace
// span directly from the source text using a small scanner.
//
// Rules followed (proposals from tests/fixtures/09-records/_notes.md):
//   - Hyphen separator is ` - ` (space-hyphen-space) — rule (a).
//   - Field separators at brace depth 0: `,` and `\n`. Trailing comma
//     before `}` is tolerated.
//   - A field whose value is a nested record may omit the `-` separator:
//     `key { ... }`. Plain scalar values use `key - value`.
//   - Every scalar value emits StringValue for now; type coercion lives
//     in a later pass (renderer / resolver).
//   - Empty record `{ }` parses to `{ fields: [] }`.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { ErrorCode } from './errors.js';
import type { ErrorCodeName } from './errors.js';
import { ParseError } from './parser-errors.js';
import type {
  Block,
  BooleanValue,
  Collection as CollectionNode,
  DataValue,
  Inline,
  NullValue,
  NumberValue,
  Record as RecordNode,
  StringValue,
  Text,
} from './ast.js';
import type { Loc } from './loc.js';

// ---------------------------------------------------------------------------
// Typed-scalar classifier (M1.09 / v0.1.0).
// Bareword values that look like numbers / booleans / null get typed
// eagerly at parse time. Quoted strings always stay as stringValue (the
// quotes signal "treat these bytes literally"). Whitespace is trimmed
// before classification.
// ---------------------------------------------------------------------------

const NUMBER_RE = /^-?(?:[0-9]+|[0-9]+\.[0-9]+)$/;

export function classifyScalar(raw: string, loc: Loc): DataValue {
  const trimmed = raw.trim();
  if (trimmed === 'true') {
    return { kind: 'booleanValue', value: true, loc } as BooleanValue;
  }
  if (trimmed === 'false') {
    return { kind: 'booleanValue', value: false, loc } as BooleanValue;
  }
  if (trimmed === 'null') {
    return { kind: 'nullValue', loc } as NullValue;
  }
  if (NUMBER_RE.test(trimmed)) {
    return { kind: 'numberValue', value: Number(trimmed), loc } as NumberValue;
  }
  return { kind: 'stringValue', value: trimmed, loc };
}

// ---------------------------------------------------------------------------
// Scanner state.
// ---------------------------------------------------------------------------

interface Scanner {
  src: string;       // raw text containing the record (and possibly more).
  pos: number;       // index into src.
  base: Loc;         // loc of src[0] in the original source.
}

// ---------------------------------------------------------------------------
// Public entry.
// ---------------------------------------------------------------------------

export interface RecordParseResult {
  record: RecordNode;
  // Index in `src` one past the closing `}`. Callers use this to know
  // whether the text continued past the record.
  endPos: number;
}

export interface CollectionParseResult {
  collection: CollectionNode;
  // Index in `src` one past the closing `]`.
  endPos: number;
}

export function tryParseRecordFromText(
  src: string,
  base: Loc,
): RecordParseResult | null {
  const startPos = skipWs(src, 0);
  if (src.charAt(startPos) !== '{') return null;
  const scanner: Scanner = { src, pos: startPos, base };
  const record = parseRecord(scanner);
  return { record, endPos: scanner.pos };
}

export function tryParseCollectionFromText(
  src: string,
  base: Loc,
): CollectionParseResult | null {
  const startPos = skipWs(src, 0);
  if (src.charAt(startPos) !== '[') return null;
  const scanner: Scanner = { src, pos: startPos, base };
  const collection = parseCollection(scanner);
  return { collection, endPos: scanner.pos };
}

// Hook used by parser-defs: a single-line def body whose only child is a
// Text node containing a `{ ... }` or `[ ... ]` literal collapses to
// `[Record]` or `[Collection]`.
export function maybeAsDataValue(
  body: (Block | Inline)[],
): (Block | Inline | RecordNode | CollectionNode)[] {
  if (body.length !== 1) return body;
  const only = body[0];
  if (only.kind !== 'text') return body;
  const text = (only as Text).value;
  const rec = tryWrapRecord(text, only.loc);
  if (rec !== null) return [rec];
  const coll = tryWrapCollection(text, only.loc);
  if (coll !== null) return [coll];
  return body;
}

function tryWrapRecord(text: string, loc: Loc): RecordNode | null {
  if (!/^\s*\{[\s\S]*\}\s*$/.test(text)) return null;
  const r = tryParseRecordFromText(text, loc);
  if (r === null || text.slice(r.endPos).trim().length !== 0) return null;
  return r.record;
}

function tryWrapCollection(text: string, loc: Loc): CollectionNode | null {
  if (!/^\s*\[[\s\S]*\]\s*$/.test(text)) return null;
  const c = tryParseCollectionFromText(text, loc);
  if (c === null || text.slice(c.endPos).trim().length !== 0) return null;
  return c.collection;
}

// ---------------------------------------------------------------------------
// Record parser.
// ---------------------------------------------------------------------------

function parseRecord(s: Scanner): RecordNode {
  const openPos = s.pos;
  expectBracket(s, '{', ErrorCode.E_MALFORMED_RECORD);
  const fields: RecordNode['fields'] = [];
  skipWsAndNewlines(s);
  while (s.pos < s.src.length && s.src.charAt(s.pos) !== '}') {
    const field = parseField(s);
    if (field !== null) fields.push(field);
    if (!consumeSeparator(s, '}')) break;
  }
  expectBracket(s, '}', ErrorCode.E_MALFORMED_RECORD);
  return {
    kind: 'record',
    fields,
    loc: locOfRange(s, openPos, s.pos),
  };
}

function consumeSeparator(s: Scanner, closer: '}' | ']'): boolean {
  // Consume any mix of `,` `\n` and inline ws between items/fields. Stop
  // if we reach the closer (caller handles), or run out of input.
  let consumed = false;
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c === ',' || c === '\n') { s.pos += 1; consumed = true; continue; }
    if (c === ' ' || c === '\t') { s.pos += 1; continue; }
    break;
  }
  return consumed || s.src.charAt(s.pos) === closer;
}

// ---------------------------------------------------------------------------
// Field parser.
// ---------------------------------------------------------------------------

function parseField(s: Scanner): { key: string; value: DataValue } | null {
  skipWsAndNewlines(s);
  if (s.src.charAt(s.pos) === '}') return null;
  if (s.src.charAt(s.pos) === ',') return null;
  const keyEnd = findFieldKeyEnd(s);
  if (keyEnd === null) {
    throw new ParseError(
      ErrorCode.E_MALFORMED_RECORD,
      'record field missing key',
      locAt(s, s.pos),
    );
  }
  const rawKey = s.src.slice(s.pos, keyEnd.keyTextEnd);
  s.pos = keyEnd.afterKey;
  const value = parseFieldValue(s, keyEnd.kind);
  return { key: rawKey.trim(), value };
}

interface KeyEnd {
  keyTextEnd: number;    // index of last char +1 of the key text (trimmed).
  afterKey: number;      // index to resume scanning for the value.
  kind: 'hyphen' | 'brace';
}

function findFieldKeyEnd(s: Scanner): KeyEnd | null {
  // Scan forward for ` - ` (hyphen value form), `:` (M15 colon form),
  // or ` {` / `{` / `[` (brace/bracket forms). Stop at `,`, `\n`, `}`.
  let i = s.pos;
  while (i < s.src.length) {
    const c = s.src.charAt(i);
    if (c === '\\' && isEscapableInRecord(s.src.charAt(i + 1))) { i += 2; continue; }
    if (c === ',' || c === '\n' || c === '}') return null;
    if (isHyphenSeparatorAt(s.src, i)) {
      return { keyTextEnd: i, afterKey: i + 3, kind: 'hyphen' };
    }
    if (c === ':') {
      return { keyTextEnd: i, afterKey: i + 1, kind: 'hyphen' };
    }
    if (c === '{' || c === '[') {
      return { keyTextEnd: i, afterKey: i, kind: 'brace' };
    }
    i += 1;
  }
  return null;
}

function isEscapableInRecord(c: string): boolean {
  return c === ':' || c === '"' || c === '\\' || c === '{' || c === '}' ||
         c === ',';
}

function isHyphenSeparatorAt(src: string, i: number): boolean {
  return src.charAt(i) === ' ' &&
         src.charAt(i + 1) === '-' &&
         src.charAt(i + 2) === ' ';
}

// ---------------------------------------------------------------------------
// Value parsers.
// ---------------------------------------------------------------------------

function parseFieldValue(s: Scanner, kind: 'hyphen' | 'brace'): DataValue {
  skipInlineWs(s);
  if (s.src.charAt(s.pos) === '{') return parseRecord(s);
  if (s.src.charAt(s.pos) === '[') return parseCollection(s);
  if (s.src.charAt(s.pos) === '"') return parseQuotedString(s);
  if (kind === 'brace') {
    throw new ParseError(
      ErrorCode.E_MALFORMED_RECORD,
      'record field missing value',
      locAt(s, s.pos),
    );
  }
  // M16.multi-line-param-values: empty same-line value followed by a
  // strictly-deeper-indented line consumes the indented block as the
  // value. Top-level `,` or `}` still terminates as usual.
  if (s.src.charAt(s.pos) === '\n') {
    const block = tryConsumeIndentedBlock(s);
    if (block !== null) return block;
  }
  return parseStringValue(s, '}');
}

// Consume an indented continuation block starting at `s.pos` (which is
// at a `\n`). Uses the key line's leading whitespace as the outer-indent
// prefix. Returns null when no deeper-indented continuation follows.
//
// Top-level `,` or `}` inside a kept line terminates the value (the
// indented block ends there); the comma/closer stays for the outer
// parseField loop to consume.
function tryConsumeIndentedBlock(s: Scanner): StringValue | null {
  const start = s.pos;
  const keyIndent = keyLineIndent(s.src, start);
  const collected: string[] = [];
  let i = start; // at `\n`
  let lastConsumedEnd = start;
  let foundContent = false;
  let terminated = false;
  while (i < s.src.length && !terminated) {
    if (s.src.charAt(i) !== '\n') break;
    const lineStart = i + 1;
    const lineEnd = findLineEnd(s.src, lineStart);
    const line = s.src.slice(lineStart, lineEnd);
    if (/^\s*$/.test(line)) { collected.push(''); i = lineEnd; continue; }
    if (!isDeeper(line, keyIndent)) break;
    const stripped = line.slice(keyIndent.length);
    const stop = findTopLevelTerminator(stripped);
    foundContent = true;
    if (stop !== -1) {
      collected.push(stripped.slice(0, stop).replace(/[ \t]+$/, ''));
      lastConsumedEnd = lineStart + keyIndent.length + stop;
      terminated = true;
      break;
    }
    collected.push(stripped.replace(/[ \t]+$/, ''));
    lastConsumedEnd = lineEnd;
    i = lineEnd;
  }
  if (!foundContent) return null;
  while (collected.length > 0 && collected[collected.length - 1] === '') {
    collected.pop();
  }
  s.pos = lastConsumedEnd;
  return {
    kind: 'stringValue',
    value: collected.join('\n'),
    loc: locOfRange(s, start, lastConsumedEnd),
  };
}

// Scan a line (after outer-indent stripped) for the first top-level `,`
// or `}` — honouring escapes, quoted strings, and nested brace/bracket
// depth. Returns the index in the line, or -1 if none found.
function findTopLevelTerminator(line: string): number {
  let depth = 0;
  let i = 0;
  while (i < line.length) {
    const c = line.charAt(i);
    if (c === '\\' && i + 1 < line.length) { i += 2; continue; }
    if (c === '"') { i = skipQuoted(line, i + 1); continue; }
    if (c === '{' || c === '[') { depth += 1; i += 1; continue; }
    if (c === '}' && depth > 0) { depth -= 1; i += 1; continue; }
    if (c === ']' && depth > 0) { depth -= 1; i += 1; continue; }
    if (depth === 0 && (c === ',' || c === '}')) return i;
    i += 1;
  }
  return -1;
}

function skipQuoted(line: string, from: number): number {
  let i = from;
  while (i < line.length) {
    const c = line.charAt(i);
    if (c === '\\' && i + 1 < line.length) { i += 2; continue; }
    if (c === '"') return i + 1;
    i += 1;
  }
  return i;
}

function keyLineIndent(src: string, posAtNewline: number): string {
  // Find the leading whitespace of the line whose newline is at posAtNewline.
  let lineStart = posAtNewline;
  while (lineStart > 0 && src.charAt(lineStart - 1) !== '\n') lineStart -= 1;
  let i = lineStart;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c !== ' ' && c !== '\t') break;
    i += 1;
  }
  return src.slice(lineStart, i);
}

function findLineEnd(src: string, from: number): number {
  let i = from;
  while (i < src.length && src.charAt(i) !== '\n') i += 1;
  return i;
}

function isDeeper(line: string, keyIndent: string): boolean {
  if (!line.startsWith(keyIndent)) return false;
  const next = line.charAt(keyIndent.length);
  return next === ' ' || next === '\t';
}

function parseQuotedString(s: Scanner): StringValue {
  // M15.form-fill: `"..."` value. Only \" and \\ escapes are recognized
  // inside; commas / newlines are content. Unterminated → error.
  const start = s.pos;
  s.pos += 1; // opening "
  let value = '';
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c === '\\') {
      const next = s.src.charAt(s.pos + 1);
      if (next === '"' || next === '\\') { value += next; s.pos += 2; continue; }
    }
    if (c === '"') {
      s.pos += 1;
      return { kind: 'stringValue', value, loc: locOfRange(s, start, s.pos) };
    }
    value += c;
    s.pos += 1;
  }
  throw new ParseError(
    ErrorCode.E_UNTERMINATED_STRING,
    'unterminated quoted string',
    locAt(s, start),
  );
}

function parseStringValue(s: Scanner, closer: '}' | ']'): DataValue {
  const start = s.pos;
  let value = '';
  let sawEscape = false;
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c === '\\') {
      const next = s.src.charAt(s.pos + 1);
      if (next === ':' || next === '"' || next === '\\' ||
          next === ',' || next === '{' || next === '}') {
        value += next; s.pos += 2; sawEscape = true; continue;
      }
    }
    if (c === ',' || c === '\n' || c === closer) break;
    value += c;
    s.pos += 1;
  }
  const loc = locOfRange(s, start, s.pos);
  // If the bareword contained escape sequences, keep it as a string —
  // the author explicitly wrote bytes, not a value to classify.
  if (sawEscape) {
    return { kind: 'stringValue', value: value.trim(), loc };
  }
  return classifyScalar(value, loc);
}

// ---------------------------------------------------------------------------
// Collection parser.
// ---------------------------------------------------------------------------

function parseCollection(s: Scanner): CollectionNode {
  const openPos = s.pos;
  expectBracket(s, '[', ErrorCode.E_UNCLOSED_COLLECTION);
  const items: DataValue[] = [];
  skipWsAndNewlines(s);
  while (s.pos < s.src.length && s.src.charAt(s.pos) !== ']') {
    const item = parseCollectionItem(s);
    if (item !== null) items.push(item);
    if (!consumeSeparator(s, ']')) break;
  }
  expectBracket(s, ']', ErrorCode.E_UNCLOSED_COLLECTION);
  return {
    kind: 'collection',
    items,
    loc: locOfRange(s, openPos, s.pos),
  };
}

function parseCollectionItem(s: Scanner): DataValue | null {
  skipWsAndNewlines(s);
  const c = s.src.charAt(s.pos);
  if (c === ']' || c === ',') return null;
  if (c === '{') return parseRecord(s);
  if (c === '[') return parseCollection(s);
  if (c === '!') return parseBangValue(s);
  return parseStringValue(s, ']');
}

// `!...!` inside a Collection element: a multi-line string cell where
// commas and newlines are content (M10.core-vocab Thread 5).
function parseBangValue(s: Scanner): StringValue {
  const start = s.pos;
  s.pos += 1; // opening !
  const contentStart = s.pos;
  while (s.pos < s.src.length && s.src.charAt(s.pos) !== '!') s.pos += 1;
  const raw = s.src.slice(contentStart, s.pos).trim();
  if (s.pos < s.src.length) s.pos += 1; // closing !
  return { kind: 'stringValue', value: raw, loc: locOfRange(s, start, s.pos) };
}

// ---------------------------------------------------------------------------
// Whitespace helpers.
// ---------------------------------------------------------------------------

function skipWs(src: string, from: number): number {
  let i = from;
  while (i < src.length) {
    const c = src.charAt(i);
    if (c !== ' ' && c !== '\t' && c !== '\n') break;
    i += 1;
  }
  return i;
}

function skipInlineWs(s: Scanner): void {
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c !== ' ' && c !== '\t') break;
    s.pos += 1;
  }
}

function skipWsAndNewlines(s: Scanner): void {
  s.pos = skipWs(s.src, s.pos);
}

// ---------------------------------------------------------------------------
// Loc helpers.
// ---------------------------------------------------------------------------

function expectBracket(
  s: Scanner,
  ch: '{' | '}' | '[' | ']',
  code: ErrorCodeName,
): void {
  if (s.src.charAt(s.pos) !== ch) {
    throw new ParseError(code, `expected '${ch}'`, locAt(s, s.pos));
  }
  s.pos += 1;
}

function locAt(s: Scanner, pos: number): Loc {
  return advanceLoc(s.base, s.src, pos);
}

function locOfRange(s: Scanner, start: number, end: number): Loc {
  const startLoc = advanceLoc(s.base, s.src, start);
  return {
    file: startLoc.file,
    line: startLoc.line,
    col: startLoc.col,
    offset: startLoc.offset,
    length: end - start,
  };
}

function advanceLoc(base: Loc, src: string, to: number): Loc {
  let line = base.line;
  let col = base.col;
  for (let i = 0; i < to; i++) {
    if (src.charAt(i) === '\n') { line += 1; col = 1; } else { col += 1; }
  }
  return {
    file: base.file,
    line,
    col,
    offset: base.offset + to,
    length: 0,
  };
}
