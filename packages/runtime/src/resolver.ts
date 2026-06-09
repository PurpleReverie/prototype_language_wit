// Resolver pass — turns a parsed Document into a ResolvedDocument.
//
// This is the scaffold: the resulting ResolvedDocument re-uses the input
// children verbatim and carries empty definitions/references tables. The
// real binding logic (collecting `#name` defs, linking `@name` uses,
// detecting unresolved/circular refs) ships in M4.bind-refs.

import type { Document } from '@wit/parser';
import type { ResolvedDocument } from './resolved-ast.js';

export interface ResolveOptions {
  // Reserved for future use (e.g. custom resolver hooks). Empty for now.
}

export function resolve(
  doc: Document,
  _options: ResolveOptions = {},
): ResolvedDocument {
  return {
    kind: 'resolved-document',
    children: doc.children,
    definitions: new Map(),
    references: new Set(),
    loc: doc.loc,
  };
}
