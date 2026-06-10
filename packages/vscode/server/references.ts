// Find-references handler. Given a position on a NodeDef (or a NodeUse
// that binds to one), walks the current document's resolved bindings and
// returns the loc of every NodeUse whose binding === target def.

import type { NodeUse, NodeDef, DataDef, Loc } from '@wit/parser';
import type { DocumentState } from './document-cache.js';
import { lookupAt } from './position-index.js';
import type { LocationLike } from './definition.js';

export function buildReferences(
  state: DocumentState,
  line: number,
  col: number,
): LocationLike[] {
  const entry = lookupAt(state.positionIndex, line, col);
  if (!entry) return [];
  const target = pickTarget(entry, state);
  if (!target) return [];
  return collectUses(state, target);
}

function pickTarget(
  entry: { kind: string; node: unknown },
  state: DocumentState,
): NodeDef | DataDef | null {
  if (entry.kind === 'nodeDef') return entry.node as NodeDef;
  if (entry.kind === 'dataDef') return entry.node as DataDef;
  if (entry.kind === 'nodeUse') {
    const use = entry.node as NodeUse;
    return state.resolved?.bindings.get(use) ?? null;
  }
  if (entry.kind === 'accessSegment') {
    const use = entry.node as NodeUse;
    return state.resolved?.dataDefs.get(use.name) ?? null;
  }
  return null;
}

function collectUses(
  state: DocumentState,
  target: NodeDef | DataDef,
): LocationLike[] {
  const out: LocationLike[] = [];
  const resolved = state.resolved;
  if (!resolved) return out;
  for (const [use, binding] of resolved.bindings) {
    if (binding === target) out.push(useToLocation(use, state.uri));
  }
  return out;
}

function useToLocation(use: NodeUse, uri: string): LocationLike {
  return { uri, range: locToRange(use.loc, use.name.length + 1) };
}

function locToRange(loc: Loc, length: number): LocationLike['range'] {
  const line = Math.max(0, loc.line - 1);
  const ch = Math.max(0, loc.col - 1);
  return {
    start: { line, character: ch },
    end: { line, character: ch + length },
  };
}
