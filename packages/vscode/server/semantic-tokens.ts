// Semantic-tokens walker. Pure function from Wit AST → flat LSP encoding.
// LSP encodes tokens as a flat number[] where every 5 numbers describe one
// token: [deltaLine, deltaStart, length, tokenType, tokenModifiers].

import type {
  Block,
  Comment,
  Document,
  EachStatement,
  IfStatement,
  Inline,
  Interpolation,
  Italic,
  Bold,
  NodeDef,
  NodeUse,
  Paragraph,
  ScriptCall,
  Loc,
} from '@wit/parser';

type Walkable = Block | Inline;

// Token-type indices into the legend (order matters — server publishes
// the same list as its capability legend).
export const SEMANTIC_TOKEN_TYPES = [
  'comment',
  'string',
  'keyword',
  'function',
  'tag',
  'parameter',
  'macro',
  'variable',
  'property',
] as const;

export type SemanticTokenType = (typeof SEMANTIC_TOKEN_TYPES)[number];

const TYPE_INDEX: Record<SemanticTokenType, number> = Object.freeze(
  Object.fromEntries(
    SEMANTIC_TOKEN_TYPES.map((t, i) => [t, i]),
  ) as Record<SemanticTokenType, number>,
);

export interface RawToken {
  line: number; // 0-based
  startChar: number; // 0-based
  length: number;
  tokenType: SemanticTokenType;
  modifiers: number;
}

// Walk the Document and produce raw tokens. Pure: no I/O, deterministic.
export function collectSemanticTokens(doc: Document): RawToken[] {
  const out: RawToken[] = [];
  visitBlocks(doc.children, out);
  return sortTokens(out);
}

// Encode raw tokens into the flat LSP wire format.
export function encodeTokens(tokens: RawToken[]): number[] {
  const sorted = sortTokens(tokens);
  const data: number[] = [];
  let prevLine = 0;
  let prevChar = 0;
  for (const t of sorted) {
    const deltaLine = t.line - prevLine;
    const deltaStart = deltaLine === 0 ? t.startChar - prevChar : t.startChar;
    data.push(deltaLine, deltaStart, t.length, TYPE_INDEX[t.tokenType], t.modifiers);
    prevLine = t.line;
    prevChar = t.startChar;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Block / inline visitors. Each helper stays under 20 lines.
// ---------------------------------------------------------------------------

function visitBlocks(blocks: ReadonlyArray<Walkable>, out: RawToken[]): void {
  for (const b of blocks) visitNode(b, out);
}

function visitNode(node: Walkable, out: RawToken[]): void {
  switch (node.kind) {
    case 'comment': return emitComment(node, out);
    case 'paragraph': return visitParagraph(node, out);
    case 'nodeUse': return emitNodeUse(node, out);
    case 'nodeDef': return emitNodeDef(node, out);
    case 'ifStatement': return emitIf(node, out);
    case 'eachStatement': return emitEach(node, out);
    case 'italic': return emitWrapped(node, 'string', out);
    case 'bold': return emitWrapped(node, 'string', out);
    case 'interpolation': return emitInterpolation(node, out);
    case 'scriptCall': return emitScriptCall(node, out);
    default: return; // text/scriptBlock/dataDef/etc. → no token (or handled elsewhere)
  }
}

function visitParagraph(p: Paragraph, out: RawToken[]): void {
  for (const child of p.children) visitNode(child, out);
}

function emitComment(c: Comment, out: RawToken[]): void {
  push(out, c.loc, 'comment');
}

function emitNodeUse(use: NodeUse, out: RawToken[]): void {
  // Tag-color the name lexeme. If access (`@x.y`) present, each segment is
  // a 'property' token.
  const nameLen = use.name.length + 1; // include leading '@'
  push(out, { ...use.loc, length: nameLen }, 'tag');
  emitAccessSegments(use, out);
  if (use.body) visitBlocks(use.body, out);
}

function emitAccessSegments(use: NodeUse, out: RawToken[]): void {
  if (!use.access || use.access.length === 0) return;
  // Approximate location: place segments starting after `@name.`. We don't
  // have per-segment loc on NodeUse, so anchor at the name's end + 1.
  let col = use.loc.col + use.name.length + 2; // '@' + name + '.'
  for (const seg of use.access) {
    push(out, { ...use.loc, col, length: seg.length }, 'property');
    col += seg.length + 1; // segment + '.'
  }
}

function emitNodeDef(def: NodeDef, out: RawToken[]): void {
  const prefix = def.additive ? 2 : 1; // '+#' or '#'
  const headLen = prefix + def.name.length;
  const type: SemanticTokenType = def.captures.length > 0 ? 'macro' : 'function';
  push(out, { ...def.loc, length: headLen }, type);
  for (const c of def.captures) emitCapture(c, out, def.loc);
  for (const child of def.body) {
    if (child.kind === 'record' || child.kind === 'collection') continue;
    visitNode(child, out);
  }
}

function emitCapture(_name: string, _out: RawToken[], _loc: Loc): void {
  // Capture names don't carry individual loc in the current AST. Skip:
  // the def-name token covers the visual head. Listed for future loc
  // enrichment without changing the API.
}

function emitIf(stmt: IfStatement, out: RawToken[]): void {
  push(out, { ...stmt.loc, length: 2 }, 'keyword'); // 'if' lexeme
  visitBlocks(stmt.then, out);
  if (stmt.else) visitBlocks(stmt.else, out);
}

function emitEach(stmt: EachStatement, out: RawToken[]): void {
  push(out, { ...stmt.loc, length: 4 }, 'keyword'); // 'each' lexeme
  visitBlocks(stmt.body, out);
}

function emitWrapped(node: Italic | Bold, type: SemanticTokenType, out: RawToken[]): void {
  push(out, node.loc, type);
  for (const c of node.children) visitNode(c, out);
}

function emitInterpolation(i: Interpolation, out: RawToken[]): void {
  push(out, i.loc, 'variable');
}

function emitScriptCall(c: ScriptCall, out: RawToken[]): void {
  push(out, c.loc, 'function');
}

// ---------------------------------------------------------------------------
// Token push + sort.
// ---------------------------------------------------------------------------

function push(out: RawToken[], loc: Loc, tokenType: SemanticTokenType): void {
  if (loc.length <= 0) return;
  out.push({
    line: Math.max(0, loc.line - 1),
    startChar: Math.max(0, loc.col - 1),
    length: loc.length,
    tokenType,
    modifiers: 0,
  });
}

function sortTokens(tokens: RawToken[]): RawToken[] {
  return [...tokens].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.startChar - b.startChar;
  });
}
