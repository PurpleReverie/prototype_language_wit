// Curated public surface for @witlang/runtime (v0.1.0).
//
// The runtime resolves cross-file references, merges additive partials,
// and expands templates into a fully-substituted document tree that
// renderers consume.

// Pipeline entry points.
export { resolve } from './resolver.js';
export { expand } from './expander.js';

// AST shapes consumers receive back.
export type { ResolvedDocument } from './resolved-ast.js';
export type { ExpandedDocument } from './expanded-ast.js';

// Resolver options + file-resolution hook for custom hosts.
export type { ResolveOptions } from './resolver.js';
export type { FileReader } from './resolver-files.js';

// Error classes — RuntimeError is the base; ResolverError and ExpanderError
// are the subclasses thrown by resolve() and expand() respectively. The
// code constants are exposed so consumers can branch on specific failures.
export {
  RuntimeError,
  ResolverError,
  ExpanderError,
  RuntimeErrorCode,
} from './errors.js';
export type { RuntimeErrorCodeName } from './errors.js';

// Core vocabulary — the 47 reserved node names + the @node opaque
// container. Renderers and tooling use these to recognise built-ins.
export {
  CORE_VOCAB_NAMES,
  RESERVED_OPAQUE,
  isCoreVocabName,
  isReservedNodeName,
} from './core-vocab.js';
