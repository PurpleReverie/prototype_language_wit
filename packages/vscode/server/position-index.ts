// Position index — flat list of AST nodes keyed by source span so that an
// LSP cursor (line, col) can be resolved to a single AST node in O(log n).
//
// The index walks a parsed Document and emits one entry per "interesting"
// node: NodeUse (with separate entries per access segment), NodeDef,
// DataDef, Interpolation, and the embedded Record/Collection contents
// inside DataDefs. Spans use 1-based (line, col) from the parser's Loc.

import type {
  Document,
  Block,
  Inline,
  NodeUse,
  NodeDef,
  DataDef,
  Paragraph,
  IfStatement,
  EachStatement,
  Interpolation,
  Italic,
  Bold,
  Record as RecordNode,
  Collection,
} from '@witlang/parser';

export type PositionKind =
  | 'nodeUse'
  | 'nodeDef'
  | 'dataDef'
  | 'interpolation'
  | 'accessSegment';

export interface PositionEntry {
  startLine: number; // 1-based
  startCol: number;  // 1-based
  endLine: number;
  endCol: number;
  kind: PositionKind;
  // Pointer to the originating AST node. For accessSegment entries this is
  // the parent NodeUse and `segmentIndex` indicates which segment.
  node: NodeUse | NodeDef | DataDef | Interpolation;
  segmentIndex?: number;
}

export function buildPositionIndex(doc: Document): PositionEntry[] {
  const out: PositionEntry[] = [];
  walkBlocks(doc.children, out);
  return sortEntries(out);
}

export function lookupAt(
  entries: readonly PositionEntry[],
  line: number,
  col: number,
): PositionEntry | undefined {
  // line/col are 1-based to match parser Loc.
  // Pick the smallest-span entry containing the cursor.
  let best: PositionEntry | undefined;
  let bestSize = Infinity;
  for (const e of entries) {
    if (!within(e, line, col)) continue;
    const size = spanSize(e);
    if (size < bestSize) { best = e; bestSize = size; }
  }
  return best;
}

function within(e: PositionEntry, line: number, col: number): boolean {
  if (line < e.startLine || line > e.endLine) return false;
  if (line === e.startLine && col < e.startCol) return false;
  if (line === e.endLine && col > e.endCol) return false;
  return true;
}

function spanSize(e: PositionEntry): number {
  if (e.startLine === e.endLine) return e.endCol - e.startCol;
  return (e.endLine - e.startLine) * 1000 + e.endCol;
}

function sortEntries(arr: PositionEntry[]): PositionEntry[] {
  return [...arr].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine;
    return a.startCol - b.startCol;
  });
}

// ---------------------------------------------------------------------------
// AST walkers.
// ---------------------------------------------------------------------------

function walkBlocks(blocks: readonly Block[], out: PositionEntry[]): void {
  for (const b of blocks) walkBlock(b, out);
}

function walkBlock(b: Block, out: PositionEntry[]): void {
  if (b.kind === 'paragraph') return walkParagraph(b, out);
  if (b.kind === 'nodeUse') return emitNodeUse(b, out);
  if (b.kind === 'nodeDef') return walkNodeDef(b, out);
  if (b.kind === 'dataDef') return emitDataDef(b, out);
  if (b.kind === 'ifStatement') return walkIf(b, out);
  if (b.kind === 'eachStatement') return walkEach(b, out);
}

function walkParagraph(p: Paragraph, out: PositionEntry[]): void {
  for (const c of p.children) walkInline(c, out);
}

function walkInline(node: Inline, out: PositionEntry[]): void {
  if (node.kind === 'nodeUse') return emitNodeUse(node, out);
  if (node.kind === 'interpolation') return emitInterpolation(node, out);
  if (node.kind === 'italic' || node.kind === 'bold') return walkWrap(node, out);
}

function walkWrap(w: Italic | Bold, out: PositionEntry[]): void {
  for (const c of w.children) walkInline(c, out);
}

function walkIf(stmt: IfStatement, out: PositionEntry[]): void {
  for (const c of stmt.then) walkBlock(c, out);
  if (stmt.else) for (const c of stmt.else) walkBlock(c, out);
}

function walkEach(stmt: EachStatement, out: PositionEntry[]): void {
  for (const c of stmt.body) walkBlock(c, out);
}

function emitNodeUse(use: NodeUse, out: PositionEntry[]): void {
  const nameLen = use.name.length + 1; // '@' + name
  out.push({
    startLine: use.loc.line,
    startCol: use.loc.col,
    endLine: use.loc.line,
    endCol: use.loc.col + nameLen,
    kind: 'nodeUse',
    node: use,
  });
  emitAccessSegments(use, out);
  if (use.body) walkChildren(use.body, out);
}

function emitAccessSegments(use: NodeUse, out: PositionEntry[]): void {
  if (!use.access || use.access.length === 0) return;
  let col = use.loc.col + use.name.length + 2; // '@' + name + '.'
  for (let i = 0; i < use.access.length; i++) {
    const seg = use.access[i]!;
    out.push({
      startLine: use.loc.line,
      startCol: col,
      endLine: use.loc.line,
      endCol: col + seg.length,
      kind: 'accessSegment',
      node: use,
      segmentIndex: i,
    });
    col += seg.length + 1;
  }
}

function walkNodeDef(def: NodeDef, out: PositionEntry[]): void {
  const headLen = (def.additive ? 2 : 1) + def.name.length;
  out.push({
    startLine: def.loc.line,
    startCol: def.loc.col,
    endLine: def.loc.line,
    endCol: def.loc.col + headLen,
    kind: 'nodeDef',
    node: def,
  });
  for (const c of def.body) {
    if (c.kind === 'record' || c.kind === 'collection') continue;
    if (isBlockKind(c.kind)) { walkBlock(c as Block, out); continue; }
    walkInline(c as Inline, out);
  }
}

function emitDataDef(def: DataDef, out: PositionEntry[]): void {
  const headLen = 1 + def.name.length; // '#' + name
  out.push({
    startLine: def.loc.line,
    startCol: def.loc.col,
    endLine: def.loc.line,
    endCol: def.loc.col + headLen,
    kind: 'dataDef',
    node: def,
  });
}

function emitInterpolation(i: Interpolation, out: PositionEntry[]): void {
  out.push({
    startLine: i.loc.line,
    startCol: i.loc.col,
    endLine: i.loc.line,
    endCol: i.loc.col + i.loc.length,
    kind: 'interpolation',
    node: i,
  });
}

function walkChildren(
  items: readonly (Block | Inline | RecordNode | Collection)[],
  out: PositionEntry[],
): void {
  for (const c of items) {
    if (c.kind === 'record' || c.kind === 'collection') continue;
    if (isBlockKind(c.kind)) { walkBlock(c as Block, out); continue; }
    walkInline(c as Inline, out);
  }
}

const BLOCK_KINDS = new Set<string>([
  'paragraph', 'comment', 'nodeUse', 'nodeDef', 'dataDef',
  'reference', 'ifStatement', 'eachStatement', 'scriptBlock',
]);

function isBlockKind(kind: string): boolean {
  return BLOCK_KINDS.has(kind);
}
