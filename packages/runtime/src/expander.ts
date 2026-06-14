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
  DataValue,
  Paragraph,
  IfStatement,
  EachStatement,
  Loc,
  Text,
} from '@witlang/parser';
import type { ResolvedDocument } from './resolved-ast.js';
import type { ExpandedDocument } from './expanded-ast.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';
import { isReservedNodeName } from './core-vocab.js';
import { expandNodeDef, expandDataValue, type Splice } from './expander-inline.js';
import { evaluateCondition, type DataLookups } from './expander-conditions.js';
import {
  createIterEnv,
  evalEachStatement,
  lookupIterEnv,
  type IterEnv,
  type IterFrame,
} from './expander-iteration.js';
import { createLhBridge } from './lh-bridge.js';
import { runScripts } from './script-runner.js';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';

const DEPTH_LIMIT = 256;

interface ExpandCtx {
  defs: Map<string, NodeDef>;
  dataDefs: Map<string, DataDef>;
  iterEnv: IterEnv;
  depth: number;
}

export function expand(resolved: ResolvedDocument): ExpandedDocument {
  const ctx: ExpandCtx = {
    defs: resolved.definitions,
    dataDefs: resolved.dataDefs,
    iterEnv: createIterEnv(),
    depth: 0,
  };
  const expanded: ExpandedDocument = {
    kind: 'expanded-document',
    children: expandBlocks(resolved.children, ctx),
    loc: structuredClone(resolved.loc),
  };
  const bridge = createLhBridge({
    expanded,
    resolved,
    parseAndExpand: (src) => {
      const sub = parse(src, '<inject>');
      const subResolved = resolve(sub);
      const subExpanded = expand(subResolved);
      return subExpanded.children;
    },
  });
  return runScripts(expanded, bridge);
}

function lookupsFromCtx(ctx: ExpandCtx): DataLookups {
  return { dataDefs: ctx.dataDefs, defs: ctx.defs, iterEnv: ctx.iterEnv };
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
  if (block.kind === 'paragraph') return expandParagraphToBlocks(block, ctx);
  if (block.kind === 'ifStatement') return expandIf(block, ctx);
  if (block.kind === 'eachStatement') return expandEach(block, ctx);
  return [structuredClone(block) as Block];
}

// A Paragraph at block position whose children include block-level
// NodeUses (`inline=false`) — e.g. `@part_seven()` on its own line, or a
// `@dl` opening a block-bodied def body — must be split into separate
// blocks around those uses. Otherwise the use's block-shaped expansion
// (paragraphs, definition lists, ...) gets flattened into the surrounding
// paragraph's inline run and paragraph boundaries are lost. Splice items
// that arrive as Block kinds are emitted as their own Block; remaining
// inlines flush into a Paragraph chunk between them.
function expandParagraphToBlocks(p: Paragraph, ctx: ExpandCtx): Block[] {
  const out: Block[] = [];
  let run: Inline[] = [];
  const loc = p.loc;
  const flush = (): void => {
    if (run.length === 0) return;
    out.push({ kind: 'paragraph', children: run, loc: structuredClone(loc) });
    run = [];
  };
  const emitSplice = (splice: Splice): void => {
    for (const node of splice) {
      if (isBlockKind(node.kind) && node.kind !== 'nodeUse') {
        flush();
        out.push(node as Block);
      } else if (node.kind === 'nodeUse' && !(node as NodeUse).inline) {
        flush();
        out.push(node as Block);
      } else {
        run.push(...toInlines(node));
      }
    }
  };
  for (const child of p.children) {
    // M17: every NodeUse in a Paragraph's children goes through
    // emitSplice so Block-kinded splice items (e.g. headings or extra
    // paragraphs from a re-parsed captured string at a DataDef field)
    // lift out of the surrounding Paragraph. Pre-M17 only block-flagged
    // uses took this path; inline uses fell through expandInline which
    // would flatten any block content to its inline children.
    if (child.kind === 'nodeUse') {
      emitSplice(expandUse(child as NodeUse, ctx));
      continue;
    }
    for (const i of expandInline(child, ctx)) run.push(i);
  }
  flush();
  if (out.length === 0) {
    return [{ kind: 'paragraph', children: [], loc: structuredClone(loc) }];
  }
  return out;
}

// Convert a Splice (mixed Block/Inline) returned by NodeUse expansion
// into Block[]. Block items pass through; runs of inline items
// accumulate into a single Paragraph so the rendered output stays a
// coherent line rather than fragmenting on every text/interpolation
// boundary (e.g. `::author:: (::year::).` after substitution should be
// one paragraph, not seven).
function spliceAsBlocks(splice: Splice): Block[] {
  const out: Block[] = [];
  let run: Inline[] = [];
  let runLoc: Loc | null = null;
  const flush = (): void => {
    if (run.length === 0) return;
    out.push({
      kind: 'paragraph',
      children: run,
      loc: structuredClone(runLoc ?? run[0]!.loc),
    });
    run = [];
    runLoc = null;
  };
  for (const node of splice) {
    if (isBlockKind(node.kind) && node.kind !== 'nodeUse') {
      flush();
      out.push(node as Block);
      continue;
    }
    if (node.kind === 'nodeUse' && !(node as NodeUse).inline) {
      flush();
      out.push(node as Block);
      continue;
    }
    if (runLoc === null) runLoc = node.loc;
    run.push(node as Inline);
  }
  flush();
  return out;
}

function expandIf(block: IfStatement, ctx: ExpandCtx): Block[] {
  const lookups = lookupsFromCtx(ctx);
  const branch = evaluateCondition(block.cond, lookups)
    ? block.then
    : (block.else ?? []);
  return expandBlocks(branch, ctx);
}

function expandEach(block: EachStatement, ctx: ExpandCtx): Block[] {
  return evalEachStatement(block, {
    lookups: lookupsFromCtx(ctx),
    expandBody: (body) => expandBlocks(body, ctx),
    pushFrame: (frame: IterFrame) => ctx.iterEnv.push(frame),
    popFrame: () => {
      ctx.iterEnv.pop();
    },
  });
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
  const iterValue = lookupIterEnv(ctx.iterEnv, use.name);
  if (iterValue !== undefined) return expandIterRef(use, iterValue);
  const def = ctx.defs.get(use.name);
  if (def !== undefined) return expandWithDef(use, def, ctx);
  const data = ctx.dataDefs.get(use.name);
  if (data !== undefined) {
    const splice = expandDataValue(use, data.value);
    if (splice !== null) return splice;
    // Container without access path — defer per M1.11; pass through.
    return [structuredClone(use) as NodeUse];
  }
  if (isReservedNodeName(use.name)) {
    // Core vocab / @node — body still needs to be expanded so any
    // nested @-refs, ::interpolations::, or scripts get processed.
    return [expandReservedUse(use, ctx)];
  }
  throw new ExpanderError(
    RuntimeErrorCode.E_UNRESOLVED_REFERENCE,
    `Unresolved reference @${use.name}`,
    use.loc,
  );
}

function expandReservedUse(use: NodeUse, ctx: ExpandCtx): NodeUse {
  const clone = structuredClone(use) as NodeUse;
  if (use.body === null) return clone;
  clone.body = expandSplice(use.body, ctx) as (typeof clone.body);
  return clone;
}

function expandIterRef(use: NodeUse, value: DataValue): Splice {
  const splice = expandDataValue(use, value);
  if (splice !== null) return splice;
  // Container without access path inside iteration — defer per M1.11
  // (matches DataDef behavior). Emit empty text so the prose stays sane.
  return [emptyTextAt(use.loc)];
}

function emptyTextAt(loc: Loc): Text {
  return { kind: 'text', value: '', loc: structuredClone(loc) };
}

function expandWithDef(use: NodeUse, def: NodeDef, ctx: ExpandCtx): Splice {
  guardDepth(ctx, use);
  ctx.depth++;
  // M-W16: when captured params carry typed values (collection / record /
  // scalar), push them as an iteration-env frame so `(each @name)` and
  // `@name.field` inside the def body can resolve against the param.
  const frame = buildTypedParamFrame(use, def);
  if (frame !== null) ctx.iterEnv.push(frame);
  try {
    const spliced = expandNodeDef({ use, def });
    return expandSplice(spliced, ctx);
  } finally {
    ctx.depth--;
    if (frame !== null) ctx.iterEnv.pop();
  }
}

function buildTypedParamFrame(
  use: NodeUse,
  def: NodeDef,
): IterFrame | null {
  if (use.params.length === 0) return null;
  const frame: IterFrame = new Map();
  // Field-keyed: match each param name against the def's captures.
  // Positional: zip in capture order.
  const fieldByName = new Map<string, DataValue>();
  let posIdx = 0;
  for (const p of use.params) {
    if (p.typedValue === undefined) {
      if (p.name === null) posIdx++;
      continue;
    }
    if (p.name !== null) {
      fieldByName.set(p.name, p.typedValue);
      continue;
    }
    const target = def.captures[posIdx++];
    if (target !== undefined) frame.set(target, p.typedValue);
  }
  for (const cap of def.captures) {
    const v = fieldByName.get(cap);
    if (v !== undefined) frame.set(cap, v);
  }
  return frame.size > 0 ? frame : null;
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
