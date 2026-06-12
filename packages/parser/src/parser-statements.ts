// Paren-statement parsing: `(if cond) ... (end)`,
// `(if cond) ... (else) ... (end)`, and
// `(each @collection as itemName) ... (end)`.
//
// Conditions:
//   - `@x.y is value`      → ComparisonCondition { op: 'is', ... }
//   - `@x.y equals value`  → ComparisonCondition { op: 'equals', ... }
//   - `@x.y`               → ExistenceCondition { path: ... }
//
// Token shape for `(if @x.y is value)`:
//   parenStatementOpen, keyword('if'), [textRun?],
//   nodeOpen('x'), dot, accessSegment('y'),
//   [textRun?], keyword('is'), textRun(' value'), parenClose
//
// Token shape for `(each @x.y as item)`:
//   parenStatementOpen, keyword('each'), [textRun?],
//   nodeOpen('x'), dot, accessSegment('y'),
//   [textRun?], keyword('as'), textRun(' item'), parenClose
//
// `(else)` and `(end)` are paren-statements with only a closer between
// the keyword and `)`. The driver calls into this module when it sees
// a parenStatementOpen + keyword('if'/'each') at block-level.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import type {
  AccessPath,
  Block,
  ComparisonCondition,
  Condition,
  DataValue,
  EachStatement,
  ExistenceCondition,
  IfStatement,
} from './ast.js';
import type { Loc } from './loc.js';
import { classifyScalar } from './parser-data.js';
import type { TokenCursor } from './parser-cursor.js';
import type { ParenStatementOpen, Token } from './tokens.js';

// ---------------------------------------------------------------------------
// Public entry.
// ---------------------------------------------------------------------------

export interface StatementOptions {
  parseBlocks: (cursor: TokenCursor, stop: BlockStopFn) => Block[];
}

// Back-compat alias retained for any internal callers.
export type IfStatementOptions = StatementOptions;

export type BlockStopFn = (cursor: TokenCursor) => boolean;

export function isIfStatementStart(cursor: TokenCursor): boolean {
  return matchesParenKeyword(cursor, 'if');
}

export function isEachStatementStart(cursor: TokenCursor): boolean {
  return matchesParenKeyword(cursor, 'each');
}

export function isStatementStart(cursor: TokenCursor): boolean {
  return isIfStatementStart(cursor) || isEachStatementStart(cursor);
}

export function parseStatementAfterParen(
  cursor: TokenCursor,
  opts: StatementOptions,
): IfStatement | EachStatement {
  if (isEachStatementStart(cursor)) return parseEachStatement(cursor, opts);
  return parseIfStatement(cursor, opts);
}

export function isElseHere(cursor: TokenCursor): boolean {
  return matchesParenKeyword(cursor, 'else');
}

export function isEndHere(cursor: TokenCursor): boolean {
  return matchesParenKeyword(cursor, 'end');
}

function matchesParenKeyword(cursor: TokenCursor, name: string): boolean {
  if (cursor.current().kind !== 'parenStatementOpen') return false;
  const next = cursor.peek(1);
  return next.kind === 'keyword' && next.name === name;
}

export function parseIfStatement(
  cursor: TokenCursor,
  opts: IfStatementOptions,
): IfStatement {
  const open = cursor.advance() as ParenStatementOpen;
  cursor.advance(); // keyword('if')
  const cond = parseCondition(cursor);
  expectParenClose(cursor);
  const thenBlocks = opts.parseBlocks(cursor, stopAtElseOrEnd);
  const elseBlocks = consumeElseBlocks(cursor, opts);
  const closeLoc = consumeEnd(cursor, open.loc);
  return buildIfStatement(open, cond, thenBlocks, elseBlocks, closeLoc);
}

function stopAtElseOrEnd(cursor: TokenCursor): boolean {
  return isElseHere(cursor) || isEndHere(cursor);
}

function consumeElseBlocks(
  cursor: TokenCursor,
  opts: IfStatementOptions,
): Block[] | undefined {
  if (!isElseHere(cursor)) return undefined;
  cursor.advance(); // parenStatementOpen
  cursor.advance(); // keyword('else')
  expectParenClose(cursor);
  return opts.parseBlocks(cursor, isEndHere);
}

function consumeEnd(cursor: TokenCursor, openLoc: Loc): Loc {
  if (!isEndHere(cursor)) return openLoc;
  cursor.advance(); // parenStatementOpen
  cursor.advance(); // keyword('end')
  return expectParenClose(cursor) ?? openLoc;
}

function expectParenClose(cursor: TokenCursor): Loc | null {
  const tok = cursor.current();
  if (tok.kind === 'parenClose') {
    cursor.advance();
    return tok.loc;
  }
  return null;
}

function buildIfStatement(
  open: ParenStatementOpen,
  cond: Condition,
  thenBlocks: Block[],
  elseBlocks: Block[] | undefined,
  closeLoc: Loc,
): IfStatement {
  const node: IfStatement = {
    kind: 'ifStatement',
    cond,
    then: thenBlocks,
    loc: spanLoc(open.loc, closeLoc),
  };
  if (elseBlocks !== undefined) node.else = elseBlocks;
  return node;
}

// ---------------------------------------------------------------------------
// Each statement.
// ---------------------------------------------------------------------------

export function parseEachStatement(
  cursor: TokenCursor,
  opts: StatementOptions,
): EachStatement {
  const open = cursor.advance() as ParenStatementOpen;
  cursor.advance(); // keyword('each')
  const collection = parseAccessPath(cursorAfterWs(cursor));
  skipWhitespaceTokens(cursor);
  expectKeyword(cursor, 'as');
  const itemName = parseItemName(cursor);
  expectParenClose(cursor);
  const body = opts.parseBlocks(cursor, isEndHere);
  const closeLoc = consumeEnd(cursor, open.loc);
  return buildEachStatement(open, collection, itemName, body, closeLoc);
}

function cursorAfterWs(cursor: TokenCursor): TokenCursor {
  skipWhitespaceTokens(cursor);
  return cursor;
}

function expectKeyword(cursor: TokenCursor, name: 'as'): void {
  const tok = cursor.current();
  if (tok.kind === 'keyword' && tok.name === name) cursor.advance();
}

function parseItemName(cursor: TokenCursor): string {
  skipWhitespaceTokens(cursor);
  let name = '';
  while (cursor.current().kind === 'textRun') {
    const tok = cursor.current() as { kind: 'textRun'; value: string };
    name += tok.value;
    cursor.advance();
  }
  return name.trim();
}

function buildEachStatement(
  open: ParenStatementOpen,
  collection: AccessPath,
  itemName: string,
  body: Block[],
  closeLoc: Loc,
): EachStatement {
  return {
    kind: 'eachStatement',
    collection,
    itemName,
    body,
    loc: spanLoc(open.loc, closeLoc),
  };
}

// ---------------------------------------------------------------------------
// Condition.
// ---------------------------------------------------------------------------

function parseCondition(cursor: TokenCursor): Condition {
  skipWhitespaceTokens(cursor);
  const path = parseAccessPath(cursor);
  skipWhitespaceTokens(cursor);
  const op = peekComparisonOp(cursor);
  if (op === null) return makeExistenceCondition(path);
  cursor.advance(); // keyword('is'/'equals')
  const value = parseRhsValue(cursor);
  return makeComparisonCondition(path, op, value);
}

function peekComparisonOp(cursor: TokenCursor): 'is' | 'equals' | null {
  const tok = cursor.current();
  if (tok.kind !== 'keyword') return null;
  if (tok.name === 'is' || tok.name === 'equals') return tok.name;
  return null;
}

function makeExistenceCondition(path: AccessPath): ExistenceCondition {
  return { kind: 'existenceCondition', path, loc: path.loc };
}

function makeComparisonCondition(
  path: AccessPath,
  op: 'is' | 'equals',
  right: DataValue,
): ComparisonCondition {
  return {
    kind: 'comparisonCondition',
    left: path,
    op,
    right,
    loc: spanLoc(path.loc, right.loc),
  };
}

// ---------------------------------------------------------------------------
// Access path.
// ---------------------------------------------------------------------------

function parseAccessPath(cursor: TokenCursor): AccessPath {
  const open = cursor.current();
  if (open.kind !== 'nodeOpen') return emptyAccessPath(open.loc);
  cursor.advance();
  const segments: string[] = [open.name];
  let endLoc: Loc = open.loc;
  while (cursor.current().kind === 'dot') {
    cursor.advance();
    const seg = cursor.current();
    if (seg.kind !== 'accessSegment') break;
    cursor.advance();
    segments.push(seg.name);
    endLoc = seg.loc;
  }
  return { segments, loc: spanLoc(open.loc, endLoc) };
}

function emptyAccessPath(loc: Loc): AccessPath {
  return { segments: [], loc };
}

// ---------------------------------------------------------------------------
// RHS value parsing — bareword scalar (StringValue for now per the
// 12-conditionals lean: comparison RHS uses the same M1.09 typing rule,
// but type coercion is deferred to a resolver pass; we keep StringValue).
// ---------------------------------------------------------------------------

function parseRhsValue(cursor: TokenCursor): DataValue {
  skipWhitespaceTokens(cursor);
  let value = '';
  const startLoc = cursor.current().loc;
  let endLoc = startLoc;
  while (!isRhsTerminator(cursor.current())) {
    const tok = cursor.advance();
    value += tokenSourceText(tok);
    endLoc = tok.loc;
  }
  return classifyScalar(value, spanLoc(startLoc, endLoc));
}

function isRhsTerminator(tok: Token): boolean {
  return tok.kind === 'parenClose' ||
         tok.kind === 'eof' ||
         tok.kind === 'paragraphBreak';
}

function tokenSourceText(tok: Token): string {
  if (tok.kind === 'textRun') return tok.value;
  return '';
}

// ---------------------------------------------------------------------------
// Whitespace helper.
// ---------------------------------------------------------------------------

function skipWhitespaceTokens(cursor: TokenCursor): void {
  while (true) {
    const tok = cursor.current();
    if (tok.kind !== 'textRun') return;
    if (!/^[ \t]+$/.test(tok.value)) return;
    cursor.advance();
  }
}

// ---------------------------------------------------------------------------
// Loc helper.
// ---------------------------------------------------------------------------

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset + end.length - start.offset,
  };
}

