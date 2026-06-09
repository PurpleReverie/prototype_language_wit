// Expander pass — turns a ResolvedDocument into an ExpandedDocument.
//
// Walks the resolved AST and for every NodeUse with a binding, splices
// the def's inlined body (Interpolation/BodySlot substituted) in place
// of the use. NodeDefs and DataDefs are dropped from the output (they
// were consumed during binding). ReferenceDirectives are also dropped —
// they're metadata, not renderable content. IfStatement/EachStatement
// remain untouched until M4.eval-conditions / M4.eval-iteration land.
//
// Loop guard: we maintain a per-NodeDef visit counter on the stack and
// throw E_EXPANSION_DEPTH_LIMIT after 256 nested expansions to catch
// runaway recursive defs.
//
// Bindings are re-resolved by name at expansion time (rather than reading
// the resolver's NodeUse→Binding side-table) because substituted bodies
// produce fresh NodeUse clones the side-table doesn't know about.

import type {
  Block,
  Inline,
  NodeUse,
  NodeDef,
  DataDef,
  Paragraph,
  IfStatement,
  EachStatement,
} from '@wit/parser';
import type { ResolvedDocument } from './resolved-ast.js';
import type { ExpandedDocument } from './expanded-ast.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';
import { expandNodeDef, expandDataRef, type Splice } from './expander-inline.js';

const DEPTH_LIMIT = 256;

interface ExpandCtx {
  defs: Map<string, NodeDef>;
  dataDefs: Map<string, DataDef>;
  depth: number;
}

export function expand(resolved: ResolvedDocument): ExpandedDocument {
  const ctx: ExpandCtx = {
    defs: resolved.definitions,
    dataDefs: resolved.dataDefs,
    depth: 0,
  };
  return {
    kind: 'expanded-document',
    children: expandBlocks(resolved.children, ctx),
    loc: structuredClone(resolved.loc),
  };
}

// ---------------------------------------------------------------------------
// Block-level walk.
// ---------------------------------------------------------------------------

function expandBlocks(blocks: readonly Block[], ctx: ExpandCtx): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    for (const b of expandBlock(block, ctx)) out.push(b);
  }
  return out;
}

function expandBlock(block: Block, ctx: ExpandCtx): Block[] {
  if (block.kind === 'nodeDef') return [];
  if (block.kind === 'dataDef') return [];
  if (block.kind === 'reference') return [];
  if (block.kind === 'nodeUse') return spliceAsBlocks(expandUse(block, ctx));
  if (block.kind === 'paragraph') return [expandParagraph(block, ctx)];
  if (block.kind === 'ifStatement') return [expandIf(block, ctx)];
  if (block.kind === 'eachStatement') return [expandEach(block, ctx)];
  return [structuredClone(block) as Block];
}

function spliceAsBlocks(splice: Splice): Block[] {
  return splice.map((node) => toBlock(node));
}

function toBlock(node: Block | Inline): Block {
  if (isBlockKind(node.kind)) return node as Block;
  // Inline node spliced at block position — wrap in a paragraph so the
  // result is uniformly Block[]. Loc reuses the inline's loc.
  return {
    kind: 'paragraph',
    children: [node as Inline],
    loc: structuredClone(node.loc),
  };
}

function expandParagraph(p: Paragraph, ctx: ExpandCtx): Paragraph {
  return {
    kind: 'paragraph',
    children: expandInlines(p.children, ctx),
    loc: structuredClone(p.loc),
  };
}

function expandIf(block: IfStatement, ctx: ExpandCtx): IfStatement {
  const next: IfStatement = {
    kind: 'ifStatement',
    cond: structuredClone(block.cond),
    then: expandBlocks(block.then, ctx),
    loc: structuredClone(block.loc),
  };
  if (block.else) next.else = expandBlocks(block.else, ctx);
  return next;
}

function expandEach(block: EachStatement, ctx: ExpandCtx): EachStatement {
  return {
    kind: 'eachStatement',
    collection: structuredClone(block.collection),
    itemName: block.itemName,
    body: expandBlocks(block.body, ctx),
    loc: structuredClone(block.loc),
  };
}

// ---------------------------------------------------------------------------
// Inline-level walk.
// ---------------------------------------------------------------------------

function expandInlines(items: readonly Inline[], ctx: ExpandCtx): Inline[] {
  const out: Inline[] = [];
  for (const item of items) {
    for (const i of expandInline(item, ctx)) out.push(i);
  }
  return out;
}

function expandInline(item: Inline, ctx: ExpandCtx): Inline[] {
  if (item.kind === 'nodeUse') return spliceAsInlines(expandUse(item, ctx));
  if (item.kind === 'italic' || item.kind === 'bold') {
    return [{ ...item, children: expandInlines(item.children, ctx) }];
  }
  return [structuredClone(item) as Inline];
}

function spliceAsInlines(splice: Splice): Inline[] {
  const out: Inline[] = [];
  for (const node of splice) {
    for (const i of toInlines(node)) out.push(i);
  }
  return out;
}

function toInlines(node: Block | Inline): Inline[] {
  if (!isBlockKind(node.kind)) return [node as Inline];
  if (node.kind === 'nodeUse') return [node as NodeUse];
  // Paragraph or other block spliced at inline position — flatten its
  // inline children. Non-paragraph blocks (e.g. nested defs) wouldn't
  // appear in inline splices in practice; emit empty text as a guard.
  if (node.kind === 'paragraph') return [...(node as Paragraph).children];
  return [{ kind: 'text', value: '', loc: structuredClone(node.loc) }];
}

// ---------------------------------------------------------------------------
// NodeUse expansion — the core of this task.
// ---------------------------------------------------------------------------

function expandUse(use: NodeUse, ctx: ExpandCtx): Splice {
  const def = ctx.defs.get(use.name);
  if (def !== undefined) return expandWithDef(use, def, ctx);
  const data = ctx.dataDefs.get(use.name);
  if (data !== undefined) {
    const splice = expandDataRef(use, data);
    if (splice !== null) return splice;
    // Container without access path — defer per M1.11; pass through.
    return [structuredClone(use) as NodeUse];
  }
  throw new ExpanderError(
    RuntimeErrorCode.E_UNRESOLVED_REFERENCE,
    `Unresolved reference @${use.name}`,
    use.loc,
  );
}

function expandWithDef(use: NodeUse, def: NodeDef, ctx: ExpandCtx): Splice {
  guardDepth(ctx, use);
  ctx.depth++;
  try {
    const spliced = expandNodeDef({ use, def });
    return expandSplice(spliced, ctx);
  } finally {
    ctx.depth--;
  }
}

function guardDepth(ctx: ExpandCtx, use: NodeUse): void {
  if (ctx.depth < DEPTH_LIMIT) return;
  throw new ExpanderError(
    RuntimeErrorCode.E_EXPANSION_DEPTH_LIMIT,
    `Expansion depth exceeded ${DEPTH_LIMIT} at @${use.name}`,
    use.loc,
  );
}

function expandSplice(splice: Splice, ctx: ExpandCtx): Splice {
  const out: Splice = [];
  for (const node of splice) {
    if (isInlinePositioned(node)) {
      for (const i of expandInline(node as Inline, ctx)) out.push(i);
    } else {
      for (const b of expandBlock(node as Block, ctx)) out.push(b);
    }
  }
  return out;
}

function isInlinePositioned(node: Block | Inline): boolean {
  if (node.kind === 'nodeUse') return (node as NodeUse).inline;
  return !isBlockKind(node.kind);
}

// ---------------------------------------------------------------------------
// Kind helpers.
// ---------------------------------------------------------------------------

const BLOCK_KINDS = new Set<string>([
  'paragraph',
  'comment',
  'nodeUse',
  'nodeDef',
  'dataDef',
  'reference',
  'ifStatement',
  'eachStatement',
  'scriptBlock',
]);

function isBlockKind(kind: string): boolean {
  return BLOCK_KINDS.has(kind);
}
