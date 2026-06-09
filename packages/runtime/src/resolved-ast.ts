// Resolved-AST shape produced by the resolver pass.
//
// A ResolvedDocument mirrors the parser's Document but carries binding
// annotations: a definitions table and the set of references seen during
// the walk. The actual binding logic lands in M4.bind-refs; this scaffold
// keeps both collections empty and simply re-uses the parser AST shape.

import type { Block, NodeDef, Loc } from '@wit/parser';

export interface ResolvedDocument {
  kind: 'resolved-document';
  children: Block[];
  definitions: Map<string, NodeDef>;
  references: Set<string>;
  loc: Loc;
}
