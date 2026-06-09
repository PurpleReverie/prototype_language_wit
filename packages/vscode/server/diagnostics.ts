// Convert WitError → LSP Diagnostic, and run the parser to collect them.

import {
  DiagnosticSeverity,
  type Diagnostic,
} from 'vscode-languageserver/node';
import { parse, WitError, type Document } from '@wit/parser';

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
  const line = Math.max(0, err.loc.line - 1);
  const col = Math.max(0, err.loc.col - 1);
  const len = Math.max(1, err.loc.length);
  return {
    severity: DiagnosticSeverity.Error,
    range: {
      start: { line, character: col },
      end: { line, character: col + len },
    },
    message: err.message,
    code: err.code,
    source: 'wit',
  };
}
