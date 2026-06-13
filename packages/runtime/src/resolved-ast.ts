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
//
// Cross-file (M4.cross-file):
// - `definitions` / `dataDefs` include entries merged in from referenced
//   files, so `@x` in the current file can bind to `#x` defined elsewhere.
// - `partials` collects additive (+#x) defs gathered from this file and
//   any referenced file. Merging is M4.merge-partials.
// - `resolvedFiles` caches each file's own ResolvedDocument by absolute
//   path so a transitively shared file is parsed once.

import type { Block, NodeDef, DataDef, NodeUse, Loc } from '@witlang/parser';

// A NodeDef produced by collapsing `+#name` partials (and an optional
// base `#name`) carries `partialSources` — the locs of every partial
// that contributed. Structurally still a NodeDef so callers that only
// need the base shape stay typed.
export interface MergedNodeDef extends NodeDef {
  partialSources: Loc[];
}

export type Binding = NodeDef | DataDef;

export interface ResolvedDocument {
  kind: 'resolved-document';
  children: Block[];
  definitions: Map<string, NodeDef>;
  dataDefs: Map<string, DataDef>;
  references: Set<string>;
  bindings: Map<NodeUse, Binding>;
  partials: Map<string, NodeDef[]>;
  resolvedFiles: Map<string, ResolvedDocument>;
  unresolvedAt: Loc[];
  loc: Loc;
}
