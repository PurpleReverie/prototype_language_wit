// Go-to-definition. Pure function: (state, position) → Location[].
//
// Location uses LSP shape: { uri, range }. The handler resolves a NodeUse
// or access-segment to its NodeDef or DataDef and emits the def's loc.

import type { NodeUse, NodeDef, DataDef, Loc } from '@wit/parser';
import type { DocumentState } from './document-cache.js';
import { lookupAt } from './position-index.js';
import { uriFromFsPath } from './cross-file.js';

export interface LocationLike {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export function buildDefinition(
  state: DocumentState,
  line: number,
  col: number,
): LocationLike[] {
  const entry = lookupAt(state.positionIndex, line, col);
  if (!entry) return [];
  if (entry.kind === 'nodeUse') return locsForUse(entry.node as NodeUse, state);
  if (entry.kind === 'accessSegment') return locsForAccess(entry.node as NodeUse, state);
  return [];
}

function locsForUse(use: NodeUse, state: DocumentState): LocationLike[] {
  const bind = state.resolved?.bindings.get(use);
  return bind ? [locationFor(bind, state)] : [];
}

function locsForAccess(use: NodeUse, state: DocumentState): LocationLike[] {
  const data = state.resolved?.dataDefs.get(use.name);
  return data ? [locationFor(data, state)] : [];
}

function locationFor(
  def: NodeDef | DataDef,
  state: DocumentState,
): LocationLike {
  const uri = uriForDef(def, state);
  return { uri, range: locToRange(def.loc, defHeadLen(def)) };
}

function uriForDef(def: NodeDef | DataDef, state: DocumentState): string {
  const file = def.loc.file;
  if (!file) return state.uri;
  if (file === state.uri) return state.uri;
  // file may already be a uri or an absolute fs path.
  if (file.startsWith('file://')) return file;
  if (file.startsWith('/')) return uriFromFsPath(file);
  return state.uri;
}

function defHeadLen(def: NodeDef | DataDef): number {
  if (def.kind === 'nodeDef') return ((def as NodeDef).additive ? 2 : 1) + def.name.length;
  return 1 + def.name.length;
}

function locToRange(loc: Loc, length: number): LocationLike['range'] {
  const line = Math.max(0, loc.line - 1);
  const ch = Math.max(0, loc.col - 1);
  return {
    start: { line, character: ch },
    end: { line, character: ch + length },
  };
}
