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
import { ParseError } from './parser-errors.js';
import type {
  Block,
  DataValue,
  Inline,
  Record as RecordNode,
  StringValue,
  Text,
} from './ast.js';
import type { Loc } from './loc.js';

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

// Hook used by parser-defs: a single-line def body whose only child is a
// Text node containing a `{ ... }` record literal collapses to `[Record]`.
export function maybeAsRecord(
  body: (Block | Inline)[],
): (Block | Inline | RecordNode)[] {
  if (body.length !== 1) return body;
  const only = body[0];
  if (only.kind !== 'text') return body;
  const text = (only as Text).value;
  if (!/^\s*\{[\s\S]*\}\s*$/.test(text)) return body;
  const result = tryParseRecordFromText(text, only.loc);
  if (result === null) return body;
  if (text.slice(result.endPos).trim().length > 0) return body;
  return [result.record];
}

// ---------------------------------------------------------------------------
// Record parser.
// ---------------------------------------------------------------------------

function parseRecord(s: Scanner): RecordNode {
  const openPos = s.pos;
  expectChar(s, '{');
  const fields: RecordNode['fields'] = [];
  skipWsAndNewlines(s);
  while (s.pos < s.src.length && s.src.charAt(s.pos) !== '}') {
    const field = parseField(s);
    if (field !== null) fields.push(field);
    if (!consumeSeparator(s)) break;
  }
  expectChar(s, '}');
  return {
    kind: 'record',
    fields,
    loc: locOfRange(s, openPos, s.pos),
  };
}

function consumeSeparator(s: Scanner): boolean {
  // Consume any mix of `,` `\n` and inline ws between fields. Stop if we
  // reach `}` (caller handles), or run out of input.
  let consumed = false;
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c === ',' || c === '\n') { s.pos += 1; consumed = true; continue; }
    if (c === ' ' || c === '\t') { s.pos += 1; continue; }
    break;
  }
  return consumed || s.src.charAt(s.pos) === '}';
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
  // Scan forward for ` - ` (hyphen value form) or ` {` / `{` (brace form).
  // Stop at `,`, `\n`, `}` (these terminate the field before a value).
  let i = s.pos;
  while (i < s.src.length) {
    const c = s.src.charAt(i);
    if (c === ',' || c === '\n' || c === '}') return null;
    if (isHyphenSeparatorAt(s.src, i)) {
      return { keyTextEnd: i, afterKey: i + 3, kind: 'hyphen' };
    }
    if (c === '{') return { keyTextEnd: i, afterKey: i, kind: 'brace' };
    i += 1;
  }
  return null;
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
  if (kind === 'brace') {
    throw new ParseError(
      ErrorCode.E_MALFORMED_RECORD,
      'record field missing value',
      locAt(s, s.pos),
    );
  }
  return parseStringValue(s);
}

function parseStringValue(s: Scanner): StringValue {
  const start = s.pos;
  while (s.pos < s.src.length) {
    const c = s.src.charAt(s.pos);
    if (c === ',' || c === '\n' || c === '}') break;
    s.pos += 1;
  }
  const raw = s.src.slice(start, s.pos);
  return {
    kind: 'stringValue',
    value: raw.trim(),
    loc: locOfRange(s, start, s.pos),
  };
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

function expectChar(s: Scanner, ch: string): void {
  if (s.src.charAt(s.pos) !== ch) {
    throw new ParseError(
      ErrorCode.E_MALFORMED_RECORD,
      `expected '${ch}' in record literal`,
      locAt(s, s.pos),
    );
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
