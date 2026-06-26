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
import {
  formFillToParams,
  isFormFillRawText,
  liftBodyScatter,
  stripBodyEscapes,
} from './parser-body-forms.js';
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
  // Structural shape wins over the downstream closer-search.
  //   - parens form: self-closing per 05-nodes-parens spec (parens
  //     close the node at `)`). The only exception is the
  //     parens-then-body shape (`@x(p) body x@` on one paragraph),
  //     pinned by fixture 05-nodes-parens/parens-then-body.wit: a
  //     matching close in the SAME paragraph promotes to bodied.
  //   - pipes form (inline) self-closes when no closer is present.
  //   - otherwise: a matching `name@` in scope means bodied. A bare
  //     `@name` with no close is a bare reference both inline and at
  //     block position when nothing follows on the paragraph; a block
  //     `@name` followed by body bytes with no close stays bodied so
  //     parseBodied can diagnose the unclosed error.
  if (paramsSource === 'parens') {
    return hasMatchingClose(cursor, name, true) ? 'bodied' : 'self';
  }
  if (paramsSource === 'pipes' && inline) {
    return hasMatchingClose(cursor, name, true) ? 'bodied' : 'self';
  }
  // W-5: block-position pipe-form `@x |a v|` followed by a paragraph
  // break and ANOTHER `@x ...` use of the same name — the later close
  // (`x@`) belongs to the next invocation, not this one. The pipe-form
  // should self-close here.
  if (paramsSource === 'pipes' && atParagraphEnd(cursor) &&
      nextParagraphStartsWithSameNodeOpen(cursor, name)) {
    return 'bare';
  }
  if (hasMatchingClose(cursor, name, inline)) return 'bodied';
  if (inline) return 'bare';
  return atParagraphEnd(cursor) ? 'bare' : 'bodied';
}

function atParagraphEnd(cursor: TokenCursor): boolean {
  const tok = cursor.current();
  // W-15: a bare `@name` at end of a def body should self-close. The
  // surrounding closer (`name#` hash-close, `!!`, next def opener) is
  // an implicit paragraph boundary for shape-detection purposes — it
  // ends the containing context so the bare ref can't possibly have
  // a body within the def.
  return tok.kind === 'paragraphBreak' ||
         tok.kind === 'eof' ||
         tok.kind === 'hashClose' ||
         tok.kind === 'bangBang' ||
         tok.kind === 'hashOpen' ||
         tok.kind === 'additivePrefix';
}

// W-5: peek past the upcoming paragraphBreak and check whether the
// first content token is another nodeOpen of the same name.
function nextParagraphStartsWithSameNodeOpen(
  cursor: TokenCursor, name: string,
): boolean {
  let i = 0;
  // Skip the current paragraphBreak run.
  while (cursor.peek(i).kind === 'paragraphBreak') i += 1;
  const tok = cursor.peek(i);
  return tok.kind === 'nodeOpen' && tok.name === name;
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
  // M15 form-fill bypass: probe the raw source span between the open and
  // its matching close BEFORE invoking the inline parser. Inline parsing
  // expands `_x_` into italic AST nodes that drop content (the original
  // bug). Form-fill bodies have line-shaped raw text that we parse here
  // directly, treating values as opaque strings.
  const rawBody = peekRawBody(cursor, open, opts.inline);
  const fastFill = rawBody !== null && paramsSource === 'none' &&
    isFormFillRawText(rawBody)
    ? formFillToParams(rawBody, open.loc) : null;
  const body = parseBodyContent(cursor, open, opts);
  const closeLoc = consumeMatchingClose(cursor, open);
  if (fastFill !== null) {
    return makeBodied(
      open, access, fastFill, 'form-fill', [], opts.inline, closeLoc,
    );
  }
  const post = applyBodyForms(
    body, params, paramsSource, open.loc, cursor.source(),
  );
  return makeBodied(
    open, access, post.params, post.paramsSource,
    post.body, opts.inline, closeLoc,
  );
}

// Look ahead for the matching `name@` close token without consuming any
// tokens. Returns the raw source substring strictly between the open
// token's end and the close token's start, or null if no matching close
// is found in scope. The substring is the text the lexer would have
// otherwise tokenized as the body — including emphasis markers and the
// like — kept as-is so form-fill values survive intact.
function peekRawBody(
  cursor: TokenCursor, open: NodeOpen, inline: boolean,
): string | null {
  let i = 0;
  while (true) {
    const tok = cursor.peek(i);
    if (tok.kind === 'eof') return null;
    if (inline && tok.kind === 'paragraphBreak') return null;
    if (tok.kind === 'nodeClose' && tok.name === open.name) {
      const start = open.loc.offset + open.loc.length;
      const end = tok.loc.offset;
      return cursor.sliceSource(start, end);
    }
    i += 1;
  }
}

interface PostBody {
  body: (Block | Inline)[];
  params: Param[];
  paramsSource: NodeUse['paramsSource'];
}

// M15.form-fill-and-colon-params: post-process a bodied NodeUse body for
// scatter. (Form-fill detection runs earlier in parseBodied against the
// raw source span and short-circuits this path entirely.) Scatter lifts
// `<id>:<v>` tokens from prose text and leaves the body text in place
// (with backslash escapes stripped).
function applyBodyForms(
  body: (Block | Inline)[],
  params: Param[],
  paramsSource: NodeUse['paramsSource'],
  _loc: Loc,
  source: string,
): PostBody {
  const lifted = liftBodyScatter(body, source);
  const merged = mergeScattered(params, lifted.params);
  const newSource = lifted.params.length > 0 && paramsSource === 'none'
    ? 'pipes' : paramsSource;
  return {
    body: stripBodyEscapes(lifted.body),
    params: merged,
    paramsSource: newSource,
  };
}

function mergeScattered(prior: Param[], lifted: Param[]): Param[] {
  if (lifted.length === 0) return prior;
  const out: Param[] = [...prior];
  for (const l of lifted) {
    const idx = out.findIndex((p) => p.name === l.name);
    if (idx >= 0) out[idx] = l; else out.push(l);
  }
  return out;
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
