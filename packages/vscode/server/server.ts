// Wit language server entry point.
// Wires LSP capabilities: textDocumentSync, semantic tokens, diagnostics,
// hover, definition, references, document symbols, completion.

import {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  SemanticTokensBuilder,
  CompletionItemKind,
  SymbolKind,
  type InitializeParams,
  type InitializeResult,
  type SemanticTokensParams,
  type SemanticTokens,
  type Hover,
  type Location,
  type DocumentSymbol,
  type CompletionList,
  type CompletionItem as LspCompletionItem,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { diagnosticsFromState } from './diagnostics.js';
import {
  collectSemanticTokens,
  encodeTokens,
  SEMANTIC_TOKEN_TYPES,
} from './semantic-tokens.js';
import { DocumentCache } from './document-cache.js';
import { DependentIndex, fsPathFromUri } from './cross-file.js';
import { buildHover } from './hover.js';
import { buildDefinition, type LocationLike } from './definition.js';
import { buildReferences } from './references.js';
import { buildDocumentSymbols, type SymbolEntry } from './document-symbols.js';
import {
  buildCompletion,
  type CompletionItem,
  type CompletionItemKindName,
} from './completion.js';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const cache = new DocumentCache();
const deps = new DependentIndex();

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      semanticTokensProvider: {
        legend: { tokenTypes: [...SEMANTIC_TOKEN_TYPES], tokenModifiers: [] },
        full: true, range: false,
      },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      completionProvider: { triggerCharacters: ['@', '#', ':', '.'] },
      // NOTE: do NOT declare diagnosticProvider — that would tell VS Code
      // to PULL diagnostics via textDocument/diagnostic. We use the PUSH
      // model (connection.sendDiagnostics on every change), so omitting
      // the capability keeps VS Code on push and avoids "Unhandled method"
      // errors flooding the channel.
    },
  };
});

documents.onDidChangeContent((change) => refresh(change.document));
documents.onDidOpen((event) => refresh(event.document));
documents.onDidClose((event) => {
  cache.removeOverlay(event.document.uri);
});

function refresh(doc: TextDocument): void {
  cache.setOverlay(doc.uri, doc.getText());
  const state = cache.update(doc.uri, doc.getText());
  void connection.sendDiagnostics({ uri: doc.uri, diagnostics: diagnosticsFromState(state) });
  const fsPath = fsPathFromUri(doc.uri);
  if (!fsPath) return;
  deps.update(fsPath, state.referencedPaths);
  for (const depPath of deps.transitiveDependents(fsPath)) refreshDependent(depPath);
}

function refreshDependent(absPath: string): void {
  const depDoc = findOpenDocByPath(absPath);
  if (!depDoc) return;
  const s = cache.update(depDoc.uri, depDoc.getText());
  void connection.sendDiagnostics({ uri: depDoc.uri, diagnostics: diagnosticsFromState(s) });
}

function findOpenDocByPath(absPath: string): TextDocument | null {
  for (const d of documents.all()) {
    if (fsPathFromUri(d.uri) === absPath) return d;
  }
  return null;
}

// --- Semantic tokens --------------------------------------------------------

connection.languages.semanticTokens.on(
  (params: SemanticTokensParams): SemanticTokens => semanticTokens(params),
);

function semanticTokens(params: SemanticTokensParams): SemanticTokens {
  const state = cache.get(params.textDocument.uri);
  if (!state?.parsed) return { data: [] };
  const raw = collectSemanticTokens(state.parsed);
  const builder = new SemanticTokensBuilder();
  const typeIndex = new Map(SEMANTIC_TOKEN_TYPES.map((n, i) => [n, i]));
  for (const t of raw) {
    builder.push(t.line, t.startChar, t.length, typeIndex.get(t.tokenType) ?? 0, t.modifiers);
  }
  void encodeTokens;
  return builder.build();
}

// --- Hover ------------------------------------------------------------------

connection.onHover((params): Hover | null => {
  const state = cache.get(params.textDocument.uri);
  if (!state) return null;
  const res = buildHover(state, params.position.line + 1, params.position.character + 1);
  if (!res) return null;
  return { contents: { kind: 'markdown', value: res.contents } };
});

// --- Go-to-definition -------------------------------------------------------

connection.onDefinition((params): Location[] => {
  const state = cache.get(params.textDocument.uri);
  if (!state) return [];
  return buildDefinition(state, params.position.line + 1, params.position.character + 1)
    .map(toLspLocation);
});

// --- References ------------------------------------------------------------

connection.onReferences((params): Location[] => {
  const state = cache.get(params.textDocument.uri);
  if (!state) return [];
  return buildReferences(state, params.position.line + 1, params.position.character + 1)
    .map(toLspLocation);
});

// --- Document symbols ------------------------------------------------------

connection.onDocumentSymbol((params): DocumentSymbol[] => {
  const state = cache.get(params.textDocument.uri);
  if (!state) return [];
  return buildDocumentSymbols(state).map(toLspSymbol);
});

// --- Completion ------------------------------------------------------------

connection.onCompletion((params): CompletionList => {
  const state = cache.get(params.textDocument.uri);
  if (!state) return { isIncomplete: false, items: [] };
  const items = buildCompletion(state, params.position.line + 1, params.position.character + 1);
  return { isIncomplete: false, items: items.map(toLspCompletionItem) };
});

// --- Mapping helpers --------------------------------------------------------

function toLspLocation(l: LocationLike): Location {
  return { uri: l.uri, range: l.range };
}

function toLspSymbol(s: SymbolEntry): DocumentSymbol {
  return {
    name: s.name,
    kind: s.kind === 'function' ? SymbolKind.Function : SymbolKind.Variable,
    range: s.range,
    selectionRange: s.selectionRange,
  };
}

function toLspCompletionItem(c: CompletionItem): LspCompletionItem {
  const item: LspCompletionItem = { label: c.label, kind: kindOf(c.kind) };
  if (c.detail) item.detail = c.detail;
  if (c.documentation) item.documentation = c.documentation;
  if (c.insertText) item.insertText = c.insertText;
  return item;
}

function kindOf(name: CompletionItemKindName): CompletionItemKind {
  switch (name) {
    case 'Keyword': return CompletionItemKind.Keyword;
    case 'Function': return CompletionItemKind.Function;
    case 'Variable': return CompletionItemKind.Variable;
    case 'Module': return CompletionItemKind.Module;
    case 'Field': return CompletionItemKind.Field;
    case 'Snippet': return CompletionItemKind.Snippet;
  }
}

documents.listen(connection);
connection.listen();
