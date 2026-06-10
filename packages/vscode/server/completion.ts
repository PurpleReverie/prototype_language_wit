// Context-aware completion. Reads the line up to the cursor, detects
// the syntactic context (@, #, ::, access path, param body), and returns
// a CompletionItem-shaped array tailored to that context.

import type { NodeUse } from '@wit/parser';
import { CORE_VOCAB_NAMES, RESERVED_OPAQUE } from '@wit/runtime';
import type { DocumentState } from './document-cache.js';
import { lookupAt } from './position-index.js';

export type CompletionItemKindName =
  | 'Keyword' | 'Function' | 'Variable' | 'Module' | 'Field' | 'Snippet';

export interface CompletionItem {
  label: string;
  kind: CompletionItemKindName;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export function buildCompletion(
  state: DocumentState,
  line: number,
  col: number,
): CompletionItem[] {
  const lineText = sourceLineAt(state.source, line);
  const before = lineText.slice(0, col - 1);
  if (endsWith(before, '::')) return completeCaptures(state, line, col);
  if (endsWithAccessDot(before)) return completeAccessFields(state, before);
  if (lastChar(before) === '@') return completeAtName(state);
  if (lastChar(before) === '#') return completeHashName(state);
  return [];
}

function completeAtName(state: DocumentState): CompletionItem[] {
  const out: CompletionItem[] = [];
  for (const name of CORE_VOCAB_NAMES) {
    out.push({ label: name, kind: 'Keyword', detail: `core: ${name}` });
  }
  out.push({ label: RESERVED_OPAQUE, kind: 'Module', detail: 'opaque pass-through' });
  if (state.resolved) addDefsToList(state.resolved, out);
  return out;
}

function addDefsToList(
  resolved: { definitions: ReadonlyMap<string, { captures: string[] }>; dataDefs: ReadonlyMap<string, { value: { kind: string } }> },
  out: CompletionItem[],
): void {
  for (const [name, def] of resolved.definitions) {
    const detail = `def: ${name}${def.captures.length > 0 ? ` (${def.captures.length} captures)` : ''}`;
    out.push({ label: name, kind: 'Function', detail });
  }
  for (const [name, def] of resolved.dataDefs) {
    out.push({ label: name, kind: 'Variable', detail: `data: ${name}`, documentation: dataDefSummary(def) });
  }
}

function dataDefSummary(def: { value: { kind: string } }): string {
  return def.value.kind === 'record' ? 'record value' : def.value.kind;
}

function completeHashName(state: DocumentState): CompletionItem[] {
  const out: CompletionItem[] = hashSnippets();
  if (state.resolved) {
    for (const name of state.resolved.definitions.keys()) {
      out.push({ label: name, kind: 'Function', detail: 'existing def' });
    }
  }
  return out;
}

function hashSnippets(): CompletionItem[] {
  return [
    { label: 'name', kind: 'Snippet', detail: 'block def scaffold', insertText: 'name\n  body\nname#' },
    { label: 'name ||a, b||', kind: 'Snippet', detail: 'block def with captures', insertText: 'name ||a, b||\n  ::a:: ::b::\nname#' },
    { label: 'name: value !!', kind: 'Snippet', detail: 'single-line def', insertText: 'name: value !!' },
  ];
}

function completeCaptures(
  state: DocumentState,
  line: number,
  col: number,
): CompletionItem[] {
  // Walk position index for a containing NodeDef.
  const def = findEnclosingNodeDef(state, line, col);
  if (!def) return [];
  return def.captures.map((c) => ({
    label: c,
    kind: 'Variable' as const,
    detail: 'capture',
  }));
}

function findEnclosingNodeDef(
  state: DocumentState,
  line: number,
  col: number,
): { captures: string[] } | null {
  if (!state.resolved) return null;
  // Naive: pick any NodeDef whose loc.line <= line and stretches past it
  // by inspecting body locs. Cheap and good enough for v1.
  let best: { captures: string[]; line: number } | null = null;
  for (const def of state.resolved.definitions.values()) {
    if (def.loc.line > line) continue;
    if (best === null || def.loc.line > best.line) {
      best = { captures: def.captures, line: def.loc.line };
    }
  }
  void col;
  return best ? { captures: best.captures } : null;
}

function completeAccessFields(
  state: DocumentState,
  before: string,
): CompletionItem[] {
  // The token before '.' is the NodeUse name. Strip back to '@'.
  const at = before.lastIndexOf('@');
  if (at < 0) return [];
  const word = before.slice(at + 1, before.length - 1);
  const name = word.split(/[\s.]/)[0] ?? '';
  const data = state.resolved?.dataDefs.get(name);
  if (!data || data.value.kind !== 'record') return [];
  return data.value.fields.map((f) => ({
    label: f.key,
    kind: 'Field' as const,
    detail: `field of #${name}`,
  }));
}

// ---------------------------------------------------------------------------

function sourceLineAt(source: string, line: number): string {
  // line is 1-based.
  const lines = source.split('\n');
  return lines[line - 1] ?? '';
}

function endsWith(s: string, suffix: string): boolean {
  return s.length >= suffix.length && s.slice(-suffix.length) === suffix;
}

function endsWithAccessDot(s: string): boolean {
  if (lastChar(s) !== '.') return false;
  // need '@word.' shape: scan back to '@'.
  const at = s.lastIndexOf('@');
  if (at < 0) return false;
  const between = s.slice(at + 1, s.length - 1);
  return /^[A-Za-z0-9_-]+$/.test(between);
}

function lastChar(s: string): string {
  return s.length > 0 ? s[s.length - 1]! : '';
}

// satisfy lint: NodeUse imported for shared typing parity.
void (null as unknown as NodeUse);
