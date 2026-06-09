// Resolved-AST shape produced by the resolver pass.
//
// A ResolvedDocument mirrors the parser's Document but carries binding
// annotations: tables of NodeDef / DataDef definitions, the set of names
// referenced anywhere in the file, and a side-table `bindings` that maps
// each NodeUse to the NodeDef or DataDef it resolves to. The bindings map
// keeps the parser AST immutable (we don't mutate NodeUse nodes).
//
// Resolution mode: the resolver throws on the FIRST unresolved reference
// (ResolverError with code E_UNRESOLVED_REFERENCE). `unresolvedAt` is
// reserved for a future non-throwing mode but is always empty today.

import type { Block, NodeDef, DataDef, NodeUse, Loc } from '@wit/parser';

export type Binding = NodeDef | DataDef;

export interface ResolvedDocument {
  kind: 'resolved-document';
  children: Block[];
  definitions: Map<string, NodeDef>;
  dataDefs: Map<string, DataDef>;
  references: Set<string>;
  bindings: Map<NodeUse, Binding>;
  unresolvedAt: Loc[];
  loc: Loc;
}
