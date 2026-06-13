// Resolver pass — turns a parsed Document into a ResolvedDocument.
//
// Three walks over the AST:
//   1. Collect every NodeDef and DataDef into name-keyed maps. Duplicate
//      non-additive NodeDef names throw E_DUPLICATE_DEFINITION. Additive
//      defs (+#x) land in `partials` for M4.merge-partials.
//   2. Merge in definitions from referenced files (cross-file pass).
//   3. Walk every NodeUse. A bare `@x` binds to a NodeDef of the same
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
} from '@witlang/parser';
import type { ResolvedDocument, Binding } from './resolved-ast.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';
import {
  collectReferences,
  defaultFileReader,
  mergeReferences,
  type FileCtx,
  type FileReader,
  type MergeTargets,
} from './resolver-files.js';
import { mergePartials } from './resolver-partials.js';
import { isReservedNodeName } from './core-vocab.js';

export interface ResolveOptions {
  rootPath?: string;
  fileReader?: FileReader;
}

export function resolve(
  doc: Document,
  options: ResolveOptions = {},
): ResolvedDocument {
  const ctx: FileCtx = {
    reader: options.fileReader ?? defaultFileReader,
    resolving: new Set<string>(),
    resolved: new Map<string, ResolvedDocument>(),
    resolveDocument: resolveDocument,
  };
  const rootPath = options.rootPath;
  guardReferences(doc, rootPath);
  if (rootPath !== undefined) ctx.resolving.add(rootPath);
  try {
    return resolveDocument(doc, ctx, rootPath ?? '<inline>');
  } finally {
    if (rootPath !== undefined) ctx.resolving.delete(rootPath);
  }
}

function guardReferences(doc: Document, rootPath: string | undefined): void {
  if (rootPath !== undefined) return;
  const refs = collectReferences(doc.children);
  if (refs.length === 0) return;
  throw new ResolverError(
    RuntimeErrorCode.E_MISSING_REFERENCE_FILE,
    'reference directive present but no rootPath option supplied',
    refs[0]!.loc,
  );
}

function resolveDocument(
  doc: Document,
  ctx: FileCtx,
  rootPath: string,
): ResolvedDocument {
  const targets: MergeTargets = {
    definitions: new Map<string, NodeDef>(),
    dataDefs: new Map<string, DataDef>(),
    partials: new Map<string, NodeDef[]>(),
    resolvedFiles: new Map<string, ResolvedDocument>(),
  };
  mergeReferences(doc, rootPath, ctx, targets);
  collectDefs(doc.children, targets.definitions, targets.dataDefs, targets.partials);
  mergePartials(targets.definitions, targets.partials);
  const references = new Set<string>();
  const bindings = new Map<NodeUse, Binding>();
  bindUses(doc.children, targets.definitions, targets.dataDefs, references, bindings);
  return buildResolved(doc, targets, references, bindings);
}

function buildResolved(
  doc: Document,
  targets: MergeTargets,
  references: Set<string>,
  bindings: Map<NodeUse, Binding>,
): ResolvedDocument {
  return {
    kind: 'resolved-document',
    children: doc.children,
    definitions: targets.definitions,
    dataDefs: targets.dataDefs,
    references,
    bindings,
    partials: targets.partials,
    resolvedFiles: targets.resolvedFiles,
    unresolvedAt: [],
    loc: doc.loc,
  };
}

// ---------------------------------------------------------------------------
// Pass 1: collect definitions.
// ---------------------------------------------------------------------------

interface CollectCtx {
  defs: Map<string, NodeDef>;
  data: Map<string, DataDef>;
  partials: Map<string, NodeDef[]>;
}

function collectDefs(
  blocks: readonly Block[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
  partials: Map<string, NodeDef[]>,
): void {
  const ctx: CollectCtx = { defs, data, partials };
  for (const block of blocks) collectFromBlock(block, ctx);
}

function collectFromBlock(block: Block, ctx: CollectCtx): void {
  if (block.kind === 'nodeDef') {
    recordNodeDef(block, ctx);
    collectFromChildren(block.body, ctx);
    return;
  }
  if (block.kind === 'dataDef') {
    recordDataDef(block, ctx.data);
    return;
  }
  if (block.kind === 'ifStatement') return collectFromIf(block, ctx);
  if (block.kind === 'eachStatement') return collectFromEach(block, ctx);
  if (block.kind === 'nodeUse') {
    if (block.body) collectFromChildren(block.body, ctx);
    return;
  }
  if (block.kind === 'paragraph') collectFromInlines(block.children, ctx);
}

function recordNodeDef(def: NodeDef, ctx: CollectCtx): void {
  if (def.additive) {
    const acc = ctx.partials.get(def.name) ?? [];
    acc.push(def);
    ctx.partials.set(def.name, acc);
    return;
  }
  if (ctx.defs.has(def.name)) {
    throw new ResolverError(
      RuntimeErrorCode.E_DUPLICATE_DEFINITION,
      `Duplicate definition #${def.name}`,
      def.loc,
    );
  }
  ctx.defs.set(def.name, def);
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

function collectFromIf(block: IfStatement, ctx: CollectCtx): void {
  for (const b of block.then) collectFromBlock(b, ctx);
  if (block.else) for (const b of block.else) collectFromBlock(b, ctx);
}

function collectFromEach(block: EachStatement, ctx: CollectCtx): void {
  for (const b of block.body) collectFromBlock(b, ctx);
}

function collectFromChildren(
  items: readonly (Block | Inline | RecordNode | Collection)[],
  ctx: CollectCtx,
): void {
  for (const item of items) collectFromChild(item, ctx);
}

function collectFromChild(
  item: Block | Inline | RecordNode | Collection,
  ctx: CollectCtx,
): void {
  if (item.kind === 'record' || item.kind === 'collection') return;
  if (isBlockKind(item.kind)) {
    collectFromBlock(item as Block, ctx);
    return;
  }
  if (item.kind === 'nodeUse' && item.body) {
    collectFromChildren(item.body, ctx);
  }
}

function collectFromInlines(
  items: readonly Inline[],
  ctx: CollectCtx,
): void {
  for (const item of items) {
    if (item.kind === 'nodeUse' && item.body) {
      collectFromChildren(item.body, ctx);
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
  // Iteration item names currently in scope (each ... as X stack). A
  // NodeUse whose name matches a scope entry resolves at expand time
  // against the iteration env, not the defs map — no binding recorded.
  iterScope: string[];
}

function bindUses(
  blocks: readonly Block[],
  defs: Map<string, NodeDef>,
  data: Map<string, DataDef>,
  refs: Set<string>,
  bindings: Map<NodeUse, Binding>,
): void {
  const ctx: BindCtx = { defs, data, refs, bindings, iterScope: [] };
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
  ctx.iterScope.push(block.itemName);
  try {
    for (const b of block.body) bindBlock(b, ctx);
  } finally {
    ctx.iterScope.pop();
  }
}

function bindNodeUse(use: NodeUse, ctx: BindCtx): void {
  ctx.refs.add(use.name);
  if (ctx.iterScope.includes(use.name)) {
    if (use.body) bindChildren(use.body, ctx);
    return;
  }
  // Core vocab + @node pass through without a binding (M10.core-vocab).
  // Access paths (e.g., @table.rows) still hit data-def lookup.
  const hasAccess = use.access !== undefined && use.access.length > 0;
  if (isReservedNodeName(use.name) && !hasAccess) {
    if (use.body) bindChildren(use.body, ctx);
    return;
  }
  const binding = lookupBinding(use, ctx);
  if (binding === undefined) {
    throw new ResolverError(
      RuntimeErrorCode.E_UNRESOLVED_REFERENCE,
      `Unresolved reference @${use.name}`, use.loc,
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
