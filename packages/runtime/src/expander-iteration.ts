// Iteration evaluation helpers for the expander.
//
// An EachStatement `(each @col as item) BODY (end)` resolves the
// collection access path (re-using `resolveAccessPath` from
// expander-conditions), then for each item:
//   1. Push `{ [itemName]: item }` as a new frame onto the iteration env.
//   2. Expand a fresh clone of BODY blocks.
//   3. Pop the frame.
//   4. Concatenate per-item outputs.
//
// Loop variable scope is body-local and lexical (M1.13 reconciliation).
// Nested each gets its own frame; inner shadows outer when names collide.
//
// Lookup precedence (for `@<name>` and `@<name>.field` resolutions):
//   iteration env (innermost-first) → DataDefs → NodeDefs.
// The iteration-env check lives in `lookupIterEnv` and `resolveAccessPath`
// (the latter already accepts an optional iterEnv via `DataLookups`).
//
// Errors:
//   - Collection access not resolving to a Collection → E_NOT_ITERABLE.
//   - Empty collection → emit no body (not an error).

import type { Block, DataValue, EachStatement } from '@wit/parser';
import { ExpanderError, RuntimeErrorCode } from './errors.js';
import { resolveAccessPath, type DataLookups } from './expander-conditions.js';

export type IterFrame = Map<string, DataValue>;
export type IterEnv = IterFrame[];

export function createIterEnv(): IterEnv {
  return [];
}

export function lookupIterEnv(
  env: IterEnv,
  name: string,
): DataValue | undefined {
  for (let i = env.length - 1; i >= 0; i--) {
    const found = env[i]!.get(name);
    if (found !== undefined) return found;
  }
  return undefined;
}

export interface EachEvalCtx {
  lookups: DataLookups;
  expandBody: (body: readonly Block[]) => Block[];
  pushFrame: (frame: IterFrame) => void;
  popFrame: () => void;
}

export function evalEachStatement(
  each: EachStatement,
  ctx: EachEvalCtx,
): Block[] {
  const collection = resolveAccessPath(each.collection, ctx.lookups);
  if (collection === null || collection.kind !== 'collection') {
    throw new ExpanderError(
      RuntimeErrorCode.E_NOT_ITERABLE,
      `Iteration target is not a collection: @${each.collection.segments.join('.')}`,
      each.collection.loc,
    );
  }
  if (collection.items.length === 0) return [];
  return expandPerItem(each, collection.items, ctx);
}

function expandPerItem(
  each: EachStatement,
  items: readonly DataValue[],
  ctx: EachEvalCtx,
): Block[] {
  const out: Block[] = [];
  for (const item of items) {
    const frame: IterFrame = new Map([[each.itemName, item]]);
    ctx.pushFrame(frame);
    try {
      for (const b of ctx.expandBody(each.body)) out.push(b);
    } finally {
      ctx.popFrame();
    }
  }
  return out;
}
