// Typed error system for the Wit parser/lexer.
// Stable error codes are exported as a const-object union for ergonomic
// switching and exhaustive matching.

import type { Loc } from './loc.js';

export const ErrorCode = {
  E_UNCLOSED_NODE: 'E_UNCLOSED_NODE',
  E_UNCLOSED_COMMENT: 'E_UNCLOSED_COMMENT',
  E_UNCLOSED_DEFINITION: 'E_UNCLOSED_DEFINITION',
  E_UNCLOSED_PAREN: 'E_UNCLOSED_PAREN',
  E_MISMATCHED_CLOSE: 'E_MISMATCHED_CLOSE',
  E_MALFORMED_RECORD: 'E_MALFORMED_RECORD',
  E_UNCLOSED_COLLECTION: 'E_UNCLOSED_COLLECTION',
  E_UNCLOSED_SCRIPT: 'E_UNCLOSED_SCRIPT',
  E_MIXED_PARAM_SOURCE: 'E_MIXED_PARAM_SOURCE',
  E_MALFORMED_FORM_FIELD: 'E_MALFORMED_FORM_FIELD',
  E_UNTERMINATED_STRING: 'E_UNTERMINATED_STRING',
} as const;

export type ErrorCodeName = (typeof ErrorCode)[keyof typeof ErrorCode];

export class WitError extends Error {
  readonly code: ErrorCodeName;
  readonly loc: Loc;

  constructor(code: ErrorCodeName, message: string, loc: Loc) {
    super(message);
    this.name = 'WitError';
    this.code = code;
    this.loc = loc;
  }
}
