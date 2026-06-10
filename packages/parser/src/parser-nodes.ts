// NodeUse parsing for `@name body name@`, `@name(...)`, `@name`,
// `@x.y.z`, and `@name |...|` pipe-form. Both block-level and
// inline contexts are supported via the same entry, which accepts
// a `blockContext` flag to decide whether trailing body lines are
// consumed.
//
// PAIRING (LIFO stack on `name`):
// - A `NodeOpen` with name X starts a block-form node when followed by
//   a NodeClose for X further down. If the close mismatches, throw
//   E_MISMATCHED_CLOSE pointing at the close.
// - If no close is found before EOF and we're in block context, throw
//   E_UNCLOSED_NODE pointing at the open.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { ErrorCode } from './errors.js';
import { ParseError } from './parser-errors.js';
import { parseParenParams, parsePipeRun } from './parser-params.js';
import {
  finalizeRecordArgUse,
  tryConsumeRecordArg,
} from './parser-record-arg.js';
import type {
  Block,
  Inline,
  NodeUse,
  Param,
} from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type { NodeOpen } from './tokens.js';

// ---------------------------------------------------------------------------
// Public entries.
// ---------------------------------------------------------------------------

export interface NodeUseOptions {
  inline: boolean;
  parseBodyInline: (c: TokenCursor) => Inline[];
  parseBodyBlocks: (c: TokenCursor, stopName: string) => (Block | Inline)[];
}

export function parseNodeUse(
  cursor: TokenCursor,
  opts: NodeUseOptions,
): NodeUse {
  const open = cursor.advance() as NodeOpen;
  const access = consumeAccessPath(cursor);
  const parenParams = tryConsumeParens(cursor);
  const pipeParams = parsePipeRun(cursor);
  const recordArg = tryConsumeRecordArg(cursor);
  if (recordArg !== null) {
    return finalizeRecordArgUse(
      open, access, parenParams, pipeParams, recordArg,
    );
  }
  const params = mergeParams(parenParams, pipeParams);
  const paramsSource = computeParamsSource(parenParams, pipeParams);
  return finalizeNodeUse(cursor, open, access, params, paramsSource, opts);
}

function finalizeNodeUse(
  cursor: TokenCursor,
  open: NodeOpen,
  access: string[] | undefined,
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
  opts: NodeUseOptions,
): NodeUse {
  // Access-path forms (`@x.y.z`) are always references, never bodied —
  // even when a `name@` close exists later, that close belongs to a
  // different (bodied) use of the same name, not to this data-access.
  if (access !== undefined) return makeBare(open, access, params, paramsSource);
  const shape = detectShape(cursor, open.name, paramsSource, opts.inline);
  if (shape === 'self') return makeSelfClosing(open, access, params, paramsSource);
  if (shape === 'bare') return makeBare(open, access, params, paramsSource);
  return parseBodied(cursor, open, access, params, paramsSource, opts);
}

// ---------------------------------------------------------------------------
// Access path.
// ---------------------------------------------------------------------------

function consumeAccessPath(cursor: TokenCursor): string[] | undefined {
  const segments: string[] = [];
  while (cursor.current().kind === 'dot') {
    cursor.advance();
    const seg = cursor.current();
    if (seg.kind !== 'accessSegment') break;
    cursor.advance();
    segments.push(seg.name);
  }
  return segments.length === 0 ? undefined : segments;
}

// ---------------------------------------------------------------------------
// Params (parens + pipes).
// ---------------------------------------------------------------------------

function tryConsumeParens(cursor: TokenCursor): Param[] | null {
  if (cursor.current().kind !== 'parenOpen') return null;
  cursor.advance();
  return parseParenParams(cursor);
}

function mergeParams(paren: Param[] | null, pipes: Param[]): Param[] {
  const out: Param[] = [];
  if (paren !== null) for (const p of paren) out.push(p);
  for (const p of pipes) out.push(p);
  return out;
}

function computeParamsSource(
  paren: Param[] | null,
  pipes: Param[],
): NodeUse['paramsSource'] {
  if (paren !== null && pipes.length > 0) return 'mixed';
  if (paren !== null) return 'parens';
  if (pipes.length > 0) return 'pipes';
  return 'none';
}

// ---------------------------------------------------------------------------
// Shape detection.
// ---------------------------------------------------------------------------

type Shape = 'self' | 'bare' | 'bodied';

function detectShape(
  cursor: TokenCursor,
  name: string,
  paramsSource: NodeUse['paramsSource'],
  inline: boolean,
): Shape {
  // Bodied first: any matching `name@` close in scope wins. Otherwise:
  //   - parens form with no matching close: self-closing `@x(...)`.
  //   - pipes form (inline) with no close: self-closing.
  //   - inline context: bare reference, no body.
  //   - block context: commit to bodied (parseBodied diagnoses
  //     unclosed / mismatched at the close site).
  if (hasMatchingClose(cursor, name, inline)) return 'bodied';
  if (paramsSource === 'parens') return 'self';
  if (paramsSource === 'pipes' && inline) return 'self';
  if (inline) return 'bare';
  return 'bodied';
}

function hasMatchingClose(
  cursor: TokenCursor,
  name: string,
  inline: boolean,
): boolean {
  // Block context: search through the entire remaining stream.
  // Inline context: limit search to the current paragraph.
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return false;
    if (inline && tok.kind === 'paragraphBreak') return false;
    if (tok.kind === 'nodeClose' && tok.name === name) return true;
    i += 1;
  }
}

// ---------------------------------------------------------------------------
// Self-closing / bare construction.
// ---------------------------------------------------------------------------

function makeSelfClosing(
  open: NodeOpen,
  access: string[] | undefined,
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
): NodeUse {
  return {
    kind: 'nodeUse',
    name: open.name,
    access,
    params,
    paramsSource,
    body: null,
    inline: false,
    closeStyle: 'parens',
    loc: open.loc,
  };
}

function makeBare(
  open: NodeOpen,
  access: string[] | undefined,
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
): NodeUse {
  return {
    kind: 'nodeUse',
    name: open.name,
    access,
    params,
    paramsSource,
    body: null,
    inline: true,
    closeStyle: 'bare',
    loc: open.loc,
  };
}

// ---------------------------------------------------------------------------
// Bodied construction (looking for `name@` close).
// ---------------------------------------------------------------------------

function parseBodied(
  cursor: TokenCursor,
  open: NodeOpen,
  access: string[] | undefined,
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
  opts: NodeUseOptions,
): NodeUse {
  const body = parseBodyContent(cursor, open, opts);
  const closeLoc = consumeMatchingClose(cursor, open);
  return makeBodied(open, access, params, paramsSource, body, opts.inline, closeLoc);
}

function parseBodyContent(
  cursor: TokenCursor,
  open: NodeOpen,
  opts: NodeUseOptions,
): (Block | Inline)[] {
  return opts.inline
    ? collectInlineBody(cursor, open.name, opts.parseBodyInline)
    : opts.parseBodyBlocks(cursor, open.name);
}

function makeBodied(
  open: NodeOpen,
  access: string[] | undefined,
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
  body: (Block | Inline)[],
  inline: boolean,
  closeLoc: Loc,
): NodeUse {
  return {
    kind: 'nodeUse', name: open.name, access, params, paramsSource,
    body, inline, closeStyle: 'named', loc: spanLoc(open.loc, closeLoc),
  };
}

function collectInlineBody(
  cursor: TokenCursor,
  _name: string,
  inlineParser: (c: TokenCursor) => Inline[],
): Inline[] {
  // Consume inline content until the matching `name@` close (the close
  // token is consumed by the caller via consumeMatchingClose).
  return inlineParser(cursor);
}

function consumeMatchingClose(cursor: TokenCursor, open: NodeOpen): Loc {
  const tok = cursor.current();
  if (tok.kind !== 'nodeClose') throwUnclosed(open);
  if (tok.name !== open.name) throwMismatched(open, tok);
  cursor.advance();
  return tok.loc;
}

function throwUnclosed(open: NodeOpen): never {
  throw new ParseError(
    ErrorCode.E_UNCLOSED_NODE,
    `unclosed @${open.name}`,
    open.loc,
  );
}

function throwMismatched(
  open: NodeOpen,
  tok: { name: string | null; loc: Loc },
): never {
  throw new ParseError(
    ErrorCode.E_MISMATCHED_CLOSE,
    `expected ${open.name}@ but got ${tok.name ?? ''}@`,
    tok.loc,
  );
}

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset + end.length - start.offset,
  };
}
