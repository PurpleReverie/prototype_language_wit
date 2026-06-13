// Shared test helpers — build a DocumentState from source text without a
// real LSP runtime so handler unit tests stay pure.

import { parse, type Document } from '@witlang/parser';
import { resolve } from '@witlang/runtime';
import { buildPositionIndex } from './position-index.js';
import type { DocumentState } from './document-cache.js';

export function stateFromSource(src: string, uri = 'inmemory://test.wit'): DocumentState {
  const parsed: Document = parse(src, uri);
  const resolved = resolve(parsed);
  return {
    uri,
    source: src,
    parsed,
    resolved,
    parseErrors: [],
    resolveErrors: [],
    positionIndex: buildPositionIndex(parsed),
    referencedPaths: [],
  };
}
