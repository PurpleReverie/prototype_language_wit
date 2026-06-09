// Typed runtime-error system for the resolver and expander passes.
//
// Mirrors the parser's `WitError` pattern: a const-object union of stable
// error codes plus a typed error class. The resolver/expander throw these
// instead of plain Errors so callers can switch on `code`.

import type { Loc } from '@wit/parser';

export const RuntimeErrorCode = {
  E_UNRESOLVED_REFERENCE: 'E_UNRESOLVED_REFERENCE',
  E_CIRCULAR_REFERENCE: 'E_CIRCULAR_REFERENCE',
  E_MISSING_REFERENCE_FILE: 'E_MISSING_REFERENCE_FILE',
  E_MISSING_FIELD: 'E_MISSING_FIELD',
  E_PARTIAL_SHAPE_MISMATCH: 'E_PARTIAL_SHAPE_MISMATCH',
  E_TYPE_MISMATCH: 'E_TYPE_MISMATCH',
  E_DUPLICATE_DEFINITION: 'E_DUPLICATE_DEFINITION',
  E_EXPANSION_DEPTH_LIMIT: 'E_EXPANSION_DEPTH_LIMIT',
} as const;

export type RuntimeErrorCodeName =
  (typeof RuntimeErrorCode)[keyof typeof RuntimeErrorCode];

export class RuntimeError extends Error {
  readonly code: RuntimeErrorCodeName;
  readonly loc: Loc;

  constructor(code: RuntimeErrorCodeName, message: string, loc: Loc) {
    super(message);
    this.name = 'RuntimeError';
    this.code = code;
    this.loc = loc;
  }
}

export class ResolverError extends RuntimeError {
  constructor(code: RuntimeErrorCodeName, message: string, loc: Loc) {
    super(code, message, loc);
    this.name = 'ResolverError';
  }
}

export class ExpanderError extends RuntimeError {
  constructor(code: RuntimeErrorCodeName, message: string, loc: Loc) {
    super(code, message, loc);
    this.name = 'ExpanderError';
  }
}
