// Document outline: walks the parsed AST and emits a flat list of
// NodeDef + DataDef entries. LSP `DocumentSymbol` is hierarchical, but
// flat is fine for a v1 outline and saves on nesting bugs.

import type { Document, NodeDef, DataDef, Block, Loc } from '@witlang/parser';
import type { DocumentState } from './document-cache.js';

export interface SymbolEntry {
  name: string;
  kind: 'function' | 'variable';
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  selectionRange: SymbolEntry['range'];
}

export function buildDocumentSymbols(state: DocumentState): SymbolEntry[] {
  if (!state.parsed) return [];
  const out: SymbolEntry[] = [];
  walk(state.parsed, out);
  return out;
}

function walk(doc: Document, out: SymbolEntry[]): void {
  for (const block of doc.children) walkBlock(block, out);
}

function walkBlock(b: Block, out: SymbolEntry[]): void {
  if (b.kind === 'nodeDef') out.push(symFromNodeDef(b));
  else if (b.kind === 'dataDef') out.push(symFromDataDef(b));
}

function symFromNodeDef(def: NodeDef): SymbolEntry {
  const headLen = (def.additive ? 2 : 1) + def.name.length;
  const r = locToRange(def.loc, headLen);
  return { name: def.name, kind: 'function', range: r, selectionRange: r };
}

function symFromDataDef(def: DataDef): SymbolEntry {
  const headLen = 1 + def.name.length;
  const r = locToRange(def.loc, headLen);
  return { name: def.name, kind: 'variable', range: r, selectionRange: r };
}

function locToRange(loc: Loc, length: number): SymbolEntry['range'] {
  const line = Math.max(0, loc.line - 1);
  const ch = Math.max(0, loc.col - 1);
  return {
    start: { line, character: ch },
    end: { line, character: ch + length },
  };
}
