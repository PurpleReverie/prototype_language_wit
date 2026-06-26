// Additive partial-merging pass (M4.merge-partials).
//
// After cross-file resolution has populated `targets.definitions` (base
// non-additive defs) and `targets.partials` (additive `+#name` entries),
// this pass folds each name's partial list into a single merged NodeDef
// stored back into `definitions`. Partials in document / DFS order land
// after the base (if any). The merged def carries a `partialSources`
// array containing the loc of each contributing partial.
//
// Errors:
// - E_PARTIAL_SHAPE_MISMATCH — partials disagree on shape or captures.

import type { Block, Inline, NodeDef, Paragraph, Record, Collection } from '@witlang/parser';

import type { MergedNodeDef } from './resolved-ast.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';

export function mergePartials(
  definitions: Map<string, NodeDef>,
  partials: Map<string, NodeDef[]>,
): void {
  for (const [name, list] of partials) {
    if (list.length === 0) continue;
    const base = definitions.get(name);
    const merged = mergeOne(name, base, list);
    definitions.set(name, merged);
  }
  // Clear partials map: once folded into a definition entry, individual
  // partial NodeDefs no longer need to participate in further merges
  // (a parent file's re-merge of this child's tables would otherwise
  // double-count them).
  partials.clear();
}

function mergeOne(
  name: string,
  base: NodeDef | undefined,
  partials: readonly NodeDef[],
): MergedNodeDef {
  const shape = base?.shape ?? partials[0]!.shape;
  const captures = base?.captures ?? partials[0]!.captures;
  // W-6: track the FIRST declaration so the mismatch diagnostic can
  // point at both the conflicting partial AND the reference declaration.
  const reference: NodeDef = base ?? partials[0]!;
  if (base !== undefined) checkOne(name, base, shape, captures, reference);
  for (const p of partials) checkOne(name, p, shape, captures, reference);
  return {
    kind: 'nodeDef',
    name,
    captures: [...captures],
    shape,
    body: concatBodies(base, partials),
    additive: true,
    loc: base?.loc ?? partials[0]!.loc,
    partialSources: partials.map((p) => p.loc),
  };
}

function checkOne(
  name: string,
  def: NodeDef,
  shape: NodeDef['shape'],
  captures: readonly string[],
  reference: NodeDef,
): void {
  if (def === reference) return;
  if (def.shape !== shape) {
    throw shapeMismatch(
      name,
      `shape ${def.shape} does not match ${shape}`,
      def, reference,
    );
  }
  if (!capturesEqual(def.captures, captures)) {
    throw shapeMismatch(name, 'captures disagree', def, reference);
  }
}

function shapeMismatch(
  name: string,
  detail: string,
  def: NodeDef,
  reference: NodeDef,
): ResolverError {
  // W-6: include the file:line of the prior declaration so the author
  // can compare against the source that set the shape/captures.
  const refLoc = `${reference.loc.file}:${reference.loc.line}`;
  return new ResolverError(
    RuntimeErrorCode.E_PARTIAL_SHAPE_MISMATCH,
    `Partial #${name} ${detail} (prior declaration at ${refLoc})`,
    def.loc,
  );
}

function capturesEqual(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function concatBodies(
  base: NodeDef | undefined,
  partials: readonly NodeDef[],
): (Block | Inline | Record | Collection)[] {
  const out: (Block | Inline | Record | Collection)[] = [];
  if (base !== undefined) out.push(...wrapPartialBody(base));
  for (const p of partials) out.push(...wrapPartialBody(p));
  return out;
}

// Each `+#name:` value-block contribution represents one logical
// element (e.g. one bibliography entry). Wrap its inline body in a
// Paragraph so block-level expansion of the merged def keeps each
// contribution on its own line, instead of fusing them into a single
// run of inlines. Bodies that already contain block items (paragraphs,
// nested defs, records) pass through unchanged.
function wrapPartialBody(
  def: NodeDef,
): readonly (Block | Inline | Record | Collection)[] {
  if (def.shape !== 'value-block') return def.body;
  if (def.body.length === 0) return def.body;
  const inlines: Inline[] = [];
  for (const item of def.body) {
    if (isInlineItem(item)) inlines.push(item as Inline);
    else return def.body;
  }
  const trimmed = trimSurroundingWhitespace(inlines);
  if (trimmed.length === 0) return def.body;
  const para: Paragraph = {
    kind: 'paragraph',
    children: trimmed,
    loc: trimmed[0]!.loc,
  };
  return [para];
}

function isInlineItem(
  item: Block | Inline | Record | Collection,
): boolean {
  const kind = (item as { kind: string }).kind;
  return kind === 'text' || kind === 'italic' || kind === 'bold'
    || kind === 'interpolation' || kind === 'comment'
    || kind === 'bodySlot' || kind === 'scriptCall'
    || kind === 'scriptBlock'
    || (kind === 'nodeUse' && (item as { inline: boolean }).inline);
}

function trimSurroundingWhitespace(items: readonly Inline[]): Inline[] {
  let start = 0;
  let end = items.length;
  while (start < end && isWhitespaceText(items[start]!)) start += 1;
  while (end > start && isWhitespaceText(items[end - 1]!)) end -= 1;
  return items.slice(start, end);
}

function isWhitespaceText(node: Inline): boolean {
  return node.kind === 'text' && /^\s*$/.test(node.value);
}
