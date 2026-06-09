// Resolver pass — turns a parsed Document into a ResolvedDocument.
//
// Two walks over the AST:
//   1. Collect every NodeDef and DataDef into name-keyed maps. Duplicate
//      non-additive NodeDef names throw E_DUPLICATE_DEFINITION. Additive
//      defs (+#x) are skipped here — M4.merge-partials owns them.
//   2. Walk every NodeUse. A bare `@x` binds to a NodeDef of the same
//      name; a dotted `@x.y` binds to a DataDef of name `x`. Unresolved
//      uses throw E_UNRESOLVED_REFERENCE at the first miss.

import type {
  Document,
  Block,
  Inline,
  NodeDef,
  DataDef,
  NodeUse,
  IfStatement,
  EachStatement,
  Record as RecordNode,
  Collection,
} from '@wit/parser';
import type { ResolvedDocument, Binding } from './resolved-ast.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';

export interface ResolveOptions {
  // Reserved for future use (e.g. custom resolver hooks). Empty for now.
}

export function resolve(
  doc: Document,
  _options: ResolveOptions = {},
): ResolvedDocument {
  const definitions = new Map<string, NodeDef>();
  const dataDefs = new Map<string, DataDef>();
  const references = new Set<string>();
  const bindings = new Map<NodeUse, Binding>();
  collectDefs(doc.children, definitions, dataDefs);
  bindUses(doc.children, definitions, dataDefs, references, bindings);
  return {
    kind: 'resolved-document',
    children: doc.children,
    definitions,
    dataDefs,
    references,
    bindings,
    unresolvedAt: [],
    loc: doc.loc,
  };
}

// ---------------------------------------------------------------------------
// Pass 1: collect definitions.
// ---------------------------------------------------------------------------

function collectDefs(
  blocks: readonly Block[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  for (const block of blocks) collectFromBlock(block, defs, data);
}

function collectFromBlock(
  block: Block,
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  if (block.kind === 'nodeDef') {
    recordNodeDef(block, defs);
    collectFromChildren(block.body, defs, data);
    return;
  }
  if (block.kind === 'dataDef') {
    recordDataDef(block, data);
    return;
  }
  if (block.kind === 'ifStatement') return collectFromIf(block, defs, data);
  if (block.kind === 'eachStatement') return collectFromEach(block, defs, data);
  if (block.kind === 'nodeUse') {
    if (block.body) collectFromChildren(block.body, defs, data);
    return;
  }
  if (block.kind === 'paragraph') collectFromInlines(block.children, defs, data);
}

function recordNodeDef(def: NodeDef, defs: Map<string, NodeDef>): void {
  if (def.additive) return;
  const prior = defs.get(def.name);
  if (prior !== undefined) {
    throw new ResolverError(
      RuntimeErrorCode.E_DUPLICATE_DEFINITION,
      `Duplicate definition #${def.name}`,
      def.loc,
    );
  }
  defs.set(def.name, def);
}

function recordDataDef(def: DataDef, data: Map<string, DataDef>): void {
  if (data.has(def.name)) {
    throw new ResolverError(
      RuntimeErrorCode.E_DUPLICATE_DEFINITION,
      `Duplicate data definition #${def.name}`,
      def.loc,
    );
  }
  data.set(def.name, def);
}

function collectFromIf(
  block: IfStatement,
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  collectDefs(block.then, defs, data);
  if (block.else) collectDefs(block.else, defs, data);
}

function collectFromEach(
  block: EachStatement,
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  collectDefs(block.body, defs, data);
}

function collectFromChildren(
  items: readonly (Block | Inline | RecordNode | Collection)[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  for (const item of items) collectFromChild(item, defs, data);
}

function collectFromChild(
  item: Block | Inline | RecordNode | Collection,
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  if (item.kind === 'record' || item.kind === 'collection') return;
  if (isBlockKind(item.kind)) {
    collectFromBlock(item as Block, defs, data);
    return;
  }
  if (item.kind === 'nodeUse' && item.body) {
    collectFromChildren(item.body, defs, data);
  }
}

function collectFromInlines(
  items: readonly Inline[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
): void {
  for (const item of items) {
    if (item.kind === 'nodeUse' && item.body) {
      collectFromChildren(item.body, defs, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 2: bind NodeUse references.
// ---------------------------------------------------------------------------

interface BindCtx {
  defs: Map<string, NodeDef>;
  data: Map<string, DataDef>;
  refs: Set<string>;
  bindings: Map<NodeUse, Binding>;
}

function bindUses(
  blocks: readonly Block[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
  refs: Set<string>,
  bindings: Map<NodeUse, Binding>,
): void {
  const ctx: BindCtx = { defs, data, refs, bindings };
  for (const block of blocks) bindBlock(block, ctx);
}

function bindBlock(block: Block, ctx: BindCtx): void {
  if (block.kind === 'nodeUse') return bindNodeUse(block, ctx);
  if (block.kind === 'nodeDef') return bindChildren(block.body, ctx);
  if (block.kind === 'paragraph') return bindInlines(block.children, ctx);
  if (block.kind === 'ifStatement') return bindIf(block, ctx);
  if (block.kind === 'eachStatement') return bindEach(block, ctx);
}

function bindIf(block: IfStatement, ctx: BindCtx): void {
  for (const b of block.then) bindBlock(b, ctx);
  if (block.else) for (const b of block.else) bindBlock(b, ctx);
}

function bindEach(block: EachStatement, ctx: BindCtx): void {
  for (const b of block.body) bindBlock(b, ctx);
}

function bindNodeUse(use: NodeUse, ctx: BindCtx): void {
  ctx.refs.add(use.name);
  const binding = lookupBinding(use, ctx);
  if (binding === undefined) {
    throw new ResolverError(
      RuntimeErrorCode.E_UNRESOLVED_REFERENCE,
      `Unresolved reference @${use.name}`,
      use.loc,
    );
  }
  ctx.bindings.set(use, binding);
  if (use.body) bindChildren(use.body, ctx);
}

function lookupBinding(use: NodeUse, ctx: BindCtx): Binding | undefined {
  const hasAccess = use.access !== undefined && use.access.length > 0;
  if (hasAccess) {
    return ctx.data.get(use.name) ?? ctx.defs.get(use.name);
  }
  return ctx.defs.get(use.name) ?? ctx.data.get(use.name);
}

function bindChildren(
  items: readonly (Block | Inline | RecordNode | Collection)[],
  ctx: BindCtx,
): void {
  for (const item of items) bindChild(item, ctx);
}

function bindChild(
  item: Block | Inline | RecordNode | Collection,
  ctx: BindCtx,
): void {
  if (item.kind === 'record' || item.kind === 'collection') return;
  if (isBlockKind(item.kind)) {
    bindBlock(item as Block, ctx);
    return;
  }
  bindInline(item as Inline, ctx);
}

function bindInlines(items: readonly Inline[], ctx: BindCtx): void {
  for (const item of items) bindInline(item, ctx);
}

function bindInline(item: Inline, ctx: BindCtx): void {
  if (item.kind === 'nodeUse') return bindNodeUse(item, ctx);
  if (item.kind === 'italic' || item.kind === 'bold') {
    bindInlines(item.children, ctx);
  }
}

// ---------------------------------------------------------------------------
// Helpers.
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
