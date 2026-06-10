// M13.records-as-args support.
//
// A NodeUse whose surface form is `@name { key - value, ... }` carries
// its named arguments via a record literal rather than a parens/pipes
// list. The lexer emits a single `recordArg` token holding the raw
// `{...}` bytes; this module re-parses those bytes through the existing
// record scanner and translates the record fields into `Param[]` keyed
// by field name. The resulting NodeUse is self-closing.
//
// Mixing record-arg with parens or pipes is rejected at parse time
// (E_MIXED_PARAM_SOURCE per M13 contract — one source per call site).
//
// Functions ≤ 20 lines (RULES 2).

import { ErrorCode } from './errors.js';
import { ParseError } from './parser-errors.js';
import { tryParseRecordFromText } from './parser-data.js';
import type {
  DataValue,
  NodeUse,
  Param,
  Record as RecordNode,
} from './ast.js';
import type { TokenCursor } from './parser-cursor.js';
import type { NodeOpen, RecordArg } from './tokens.js';

export function tryConsumeRecordArg(cursor: TokenCursor): RecordArg | null {
  if (cursor.current().kind !== 'recordArg') return null;
  return cursor.advance() as RecordArg;
}

export function finalizeRecordArgUse(
  open: NodeOpen,
  access: string[] | undefined,
  parenParams: Param[] | null,
  pipeParams: Param[],
  recordArg: RecordArg,
): NodeUse {
  if (parenParams !== null || pipeParams.length > 0) {
    throw new ParseError(
      ErrorCode.E_MIXED_PARAM_SOURCE,
      'cannot combine record-arg `{...}` with parens or pipes on the same node use',
      recordArg.loc,
    );
  }
  return {
    kind: 'nodeUse',
    name: open.name,
    access,
    params: recordToParams(recordArg),
    paramsSource: 'record',
    body: null,
    inline: false,
    closeStyle: 'parens',
    loc: open.loc,
  };
}

function recordToParams(recordArg: RecordArg): Param[] {
  const parsed = tryParseRecordFromText(recordArg.text, recordArg.loc);
  if (parsed === null) {
    throw new ParseError(
      ErrorCode.E_MALFORMED_RECORD,
      'invalid record literal in node-use record-arg',
      recordArg.loc,
    );
  }
  const out: Param[] = [];
  for (const field of parsed.record.fields) {
    out.push({
      name: field.key,
      value: dataValueToString(field.value),
      loc: structuredClone(field.value.loc),
    });
  }
  return out;
}

function dataValueToString(v: DataValue): string {
  if (v.kind === 'stringValue') return v.value;
  if (v.kind === 'numberValue') return String(v.value);
  if (v.kind === 'booleanValue') return String(v.value);
  if (v.kind === 'nullValue') return '';
  // Record/Collection nested values — uncommon path. Serialize as JSON so
  // the value at least round-trips into the capture environment.
  return JSON.stringify(stripLoc(v));
}

function stripLoc(v: DataValue | RecordNode): unknown {
  if (v.kind === 'record') {
    return {
      fields: v.fields.map((f) => ({ key: f.key, value: stripLoc(f.value) })),
    };
  }
  if (v.kind === 'collection') {
    return { items: v.items.map((it) => stripLoc(it)) };
  }
  if (v.kind === 'stringValue') return v.value;
  if (v.kind === 'numberValue') return v.value;
  if (v.kind === 'booleanValue') return v.value;
  return null;
}
