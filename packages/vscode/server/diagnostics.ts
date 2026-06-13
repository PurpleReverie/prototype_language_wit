// Convert WitError / ResolverError → LSP Diagnostic.
// Two entry points: parseAndDiagnose (legacy, parse-only) and
// diagnosticsFromState (new — emits parse + resolve errors).

import {
  DiagnosticSeverity,
  type Diagnostic,
} from 'vscode-languageserver/node';
import { parse, WitError, type Document } from '@witlang/parser';
import { ResolverError } from '@witlang/runtime';
import type { DocumentState } from './document-cache.js';

export interface ParseOutcome {
  ast: Document | null;
  diagnostics: Diagnostic[];
}

export function parseAndDiagnose(text: string, uri: string): ParseOutcome {
  try {
    const ast = parse(text, uri);
    return { ast, diagnostics: [] };
  } catch (err) {
    return { ast: null, diagnostics: [toDiagnostic(err)] };
  }
}

export function diagnosticsFromState(state: DocumentState): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const err of state.parseErrors) out.push(witErrorToDiagnostic(err));
  for (const err of state.resolveErrors) {
    if (err instanceof ResolverError) out.push(resolverErrorToDiagnostic(err));
    else if (err instanceof WitError) out.push(witErrorToDiagnostic(err));
  }
  return out;
}

function toDiagnostic(err: unknown): Diagnostic {
  if (err instanceof WitError) return witErrorToDiagnostic(err);
  const message = err instanceof Error ? err.message : String(err);
  return {
    severity: DiagnosticSeverity.Error,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    message,
    source: 'wit',
  };
}

function witErrorToDiagnostic(err: WitError): Diagnostic {
  return locToDiag(err.code, err.message, err.loc);
}

function resolverErrorToDiagnostic(err: ResolverError): Diagnostic {
  return locToDiag(err.code, err.message, err.loc);
}

function locToDiag(
  code: string,
  message: string,
  loc: { line: number; col: number; length: number },
): Diagnostic {
  const line = Math.max(0, loc.line - 1);
  const col = Math.max(0, loc.col - 1);
  const len = Math.max(1, loc.length);
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line, character: col },
      end: { line, character: col + len },
    },
    message,
    code,
    source: 'wit',
  };
}
