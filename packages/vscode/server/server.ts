// Wit language server entry point.
// Implements: text-document sync (incremental), diagnostics, semantic tokens.
// Started as a child process from the client extension (extension.ts).

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  SemanticTokensBuilder,
  type InitializeParams,
  type InitializeResult,
  type SemanticTokensParams,
  type SemanticTokens,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseAndDiagnose } from './diagnostics.js';
import {
  collectSemanticTokens,
  encodeTokens,
  SEMANTIC_TOKEN_TYPES,
} from './semantic-tokens.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      semanticTokensProvider: {
        legend: {
          tokenTypes: [...SEMANTIC_TOKEN_TYPES],
          tokenModifiers: [],
        },
        full: true,
        range: false,
      },
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
  };
});

documents.onDidChangeContent((change) => {
  publishDiagnostics(change.document);
});

documents.onDidOpen((event) => {
  publishDiagnostics(event.document);
});

function publishDiagnostics(doc: TextDocument): void {
  const { diagnostics } = parseAndDiagnose(doc.getText(), doc.uri);
  void connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

connection.languages.semanticTokens.on(
  (params: SemanticTokensParams): SemanticTokens => buildSemanticTokens(params),
);

function buildSemanticTokens(params: SemanticTokensParams): SemanticTokens {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return { data: [] };
  const { ast } = parseAndDiagnose(doc.getText(), doc.uri);
  if (!ast) return { data: [] };
  const raw = collectSemanticTokens(ast);
  return buildFromRaw(raw);
}

function buildFromRaw(raw: ReturnType<typeof collectSemanticTokens>): SemanticTokens {
  // Use SemanticTokensBuilder for correct delta-encoding; equivalent to
  // encodeTokens() but uses the LSP-provided helper for safety.
  const builder = new SemanticTokensBuilder();
  const typeIndex = new Map(SEMANTIC_TOKEN_TYPES.map((n, i) => [n, i]));
  for (const t of raw) {
    const idx = typeIndex.get(t.tokenType) ?? 0;
    builder.push(t.line, t.startChar, t.length, idx, t.modifiers);
  }
  // Reference encodeTokens here so the unused-import lint stays clean if
  // SemanticTokensBuilder is swapped out in future revisions.
  void encodeTokens;
  return builder.build();
}

documents.listen(connection);
connection.listen();
