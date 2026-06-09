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

import type { Block, Inline, NodeDef, Record, Collection } from '@wit/parser';

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
  if (base !== undefined) checkOne(name, base, shape, captures);
  for (const p of partials) checkOne(name, p, shape, captures);
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
): void {
  if (def.shape !== shape) {
    throw shapeMismatch(name, `shape ${def.shape} does not match ${shape}`, def);
  }
  if (!capturesEqual(def.captures, captures)) {
    throw shapeMismatch(name, 'captures disagree', def);
  }
}

function shapeMismatch(
  name: string,
  detail: string,
  def: NodeDef,
): ResolverError {
  return new ResolverError(
    RuntimeErrorCode.E_PARTIAL_SHAPE_MISMATCH,
    `Partial #${name} ${detail}`,
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
  if (base !== undefined) out.push(...base.body);
  for (const p of partials) out.push(...p.body);
  return out;
}
