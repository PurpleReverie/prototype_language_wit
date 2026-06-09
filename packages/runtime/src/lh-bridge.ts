// lh bridge — the `lh` global object exposed to <% %> script blocks.
//
// Scripts run AFTER inline/if/each expansion, against the expanded
// document tree. The bridge gives scripts:
//   - lh.data  — read-only proxy over the resolved doc's DataDefs.
//                `lh.data.findings` returns the resolved data value
//                (DataValue), or undefined if the name is unknown.
//   - lh.query(kindName)  — every node in the tree whose `kind` matches.
//   - lh.node(id)         — first node whose `params` carries an `id`
//                           matching the argument, or undefined.
//   - lh.sort(kindName, cmp) — reorder all instances of a kind in place
//                              within their parent (preserves siblings).
//   - lh.inject(id, src)  — re-parse src and splice into the placeholder
//                           with id=<id>. Best-effort v1 helper.
//   - lh.set(path, value) — write into an overlay map (no AST mutation).
//   - lh.prose()          — concatenated text content with .wordCount().
//
// This is v1 / best-effort surface: scripts are trusted authoring input.
// Real sandboxing and a polished surface are out of scope here.

import type {
  Block,
  Collection as CollectionNode,
  DataValue,
  Inline,
  NodeUse,
  Record as RecordNode,
} from '@wit/parser';
import { canonicalizeKey } from './canonical-key.js';
import type { ExpandedDocument } from './expanded-ast.js';
import type { ResolvedDocument } from './resolved-ast.js';

// lh.data exposes each DataDef as a plain JS value:
//   - StringValue → string
//   - NumberValue → number
//   - BooleanValue → boolean
//   - NullValue → null
//   - Record → proxy with canonical-key field access (so `paper.word_target`
//     reaches a field keyed `word target`).
//   - Collection → array of the same shape.
// Scripts read `lh.data.paper.word_target` and get a string back.
export type LhData = unknown;

export interface LhBridge {
  readonly data: Record<string, LhData | undefined>;
  readonly overlay: Map<string, unknown>;
  query(kindName: string): TreeNode[];
  node(id: string): TreeNode | undefined;
  sort(kindName: string, cmp: (a: TreeNode, b: TreeNode) => number): void;
  inject(id: string, witSource: string): void;
  set(path: string, value: unknown): void;
  prose(): ProseResult;
}

export type TreeNode = Block | Inline;

export interface ProseResult {
  text: string;
  wordCount(): number;
}

export interface BridgeDeps {
  expanded: ExpandedDocument;
  resolved: ResolvedDocument;
  parseAndExpand?: (src: string) => Block[];
}

export function createLhBridge(deps: BridgeDeps): LhBridge {
  const overlay = new Map<string, unknown>();
  const data = buildDataProxy(deps.resolved);
  return {
    data,
    overlay,
    query: (kindName) => queryByKind(deps.expanded, kindName),
    node: (id) => findById(deps.expanded, id),
    sort: (kindName, cmp) => sortInPlace(deps.expanded, kindName, cmp),
    inject: (id, src) => injectInto(deps, id, src),
    set: (path, value) => {
      overlay.set(path, value);
    },
    prose: () => proseResult(deps.expanded),
  };
}

// ---------------------------------------------------------------------------
// lh.data — read-only proxy over resolved DataDefs.
// ---------------------------------------------------------------------------

function buildDataProxy(
  resolved: ResolvedDocument,
): Record<string, LhData | undefined> {
  const target: Record<string, LhData | undefined> = {};
  return new Proxy(target, {
    get: (_t, key) => {
      if (typeof key !== 'string') return undefined;
      const def = resolved.dataDefs.get(key);
      return def === undefined ? undefined : asLhValue(def.value);
    },
    has: (_t, key) => typeof key === 'string' && resolved.dataDefs.has(key),
    set: () => false,
    deleteProperty: () => false,
  });
}

function asLhValue(value: DataValue): LhData {
  if (value.kind === 'stringValue') return value.value;
  if (value.kind === 'numberValue') return value.value;
  if (value.kind === 'booleanValue') return value.value;
  if (value.kind === 'nullValue') return null;
  if (value.kind === 'record') return recordProxy(value);
  return collectionArray(value);
}

function recordProxy(record: RecordNode): Record<string, LhData> {
  const index = new Map<string, DataValue>();
  for (const f of record.fields) index.set(canonicalizeKey(f.key), f.value);
  return new Proxy({} as Record<string, LhData>, {
    get: (_t, key) => {
      if (typeof key !== 'string') return undefined;
      const hit = index.get(canonicalizeKey(key));
      return hit === undefined ? undefined : asLhValue(hit);
    },
    has: (_t, key) => typeof key === 'string' && index.has(canonicalizeKey(key)),
    ownKeys: () => record.fields.map((f) => f.key),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

function collectionArray(coll: CollectionNode): LhData[] {
  return coll.items.map((item) => asLhValue(item));
}

// ---------------------------------------------------------------------------
// Tree walking helpers (shared by query / node / sort / prose).
// ---------------------------------------------------------------------------

function queryByKind(expanded: ExpandedDocument, kindName: string): TreeNode[] {
  const out: TreeNode[] = [];
  walkTree(expanded.children, (n) => {
    if (n.kind === kindName) out.push(n);
  });
  return out;
}

function findById(
  expanded: ExpandedDocument,
  id: string,
): TreeNode | undefined {
  let hit: TreeNode | undefined;
  walkTree(expanded.children, (n) => {
    if (hit !== undefined) return;
    if (nodeIdMatches(n, id)) hit = n;
  });
  return hit;
}

function nodeIdMatches(node: TreeNode, id: string): boolean {
  if (node.kind !== 'nodeUse') return false;
  const u = node as NodeUse;
  const idParam = u.params.find((p) => p.name === 'id');
  return idParam !== undefined && idParam.value === id;
}

function walkTree(
  nodes: readonly TreeNode[],
  visit: (n: TreeNode) => void,
): void {
  for (const n of nodes) {
    visit(n);
    for (const c of childrenOf(n)) walkTree([c], visit);
  }
}

function childrenOf(node: TreeNode): TreeNode[] {
  if (node.kind === 'paragraph') return [...node.children];
  if (node.kind === 'italic' || node.kind === 'bold') return [...node.children];
  if (node.kind === 'nodeUse' && node.body !== null) return [...node.body];
  if (node.kind === 'ifStatement') {
    return [...node.then, ...(node.else ?? [])];
  }
  if (node.kind === 'eachStatement') return [...node.body];
  return [];
}

// ---------------------------------------------------------------------------
// Sort — reorder all instances of a kind within their direct parent.
// ---------------------------------------------------------------------------

function sortInPlace(
  expanded: ExpandedDocument,
  kindName: string,
  cmp: (a: TreeNode, b: TreeNode) => number,
): void {
  sortInList(expanded.children, kindName, cmp);
  walkContainers(expanded.children, (list) => {
    sortInList(list, kindName, cmp);
  });
}

function sortInList(
  list: TreeNode[],
  kindName: string,
  cmp: (a: TreeNode, b: TreeNode) => number,
): void {
  const indices: number[] = [];
  const picked: TreeNode[] = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i]!.kind === kindName) {
      indices.push(i);
      picked.push(list[i]!);
    }
  }
  if (picked.length < 2) return;
  picked.sort(cmp);
  for (let k = 0; k < indices.length; k++) {
    list[indices[k]!] = picked[k]!;
  }
}

function walkContainers(
  nodes: readonly TreeNode[],
  visit: (list: TreeNode[]) => void,
): void {
  for (const n of nodes) {
    const list = mutableChildList(n);
    if (list !== null) {
      visit(list);
      walkContainers(list, visit);
    }
  }
}

function mutableChildList(node: TreeNode): TreeNode[] | null {
  if (node.kind === 'paragraph') return node.children as TreeNode[];
  if (node.kind === 'italic' || node.kind === 'bold') {
    return node.children as TreeNode[];
  }
  if (node.kind === 'nodeUse' && node.body !== null) {
    return node.body as TreeNode[];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Inject — replace a placeholder NodeUse body with parsed wit source.
// ---------------------------------------------------------------------------

function injectInto(deps: BridgeDeps, id: string, witSource: string): void {
  const target = findById(deps.expanded, id);
  if (target === undefined || target.kind !== 'nodeUse') return;
  if (deps.parseAndExpand === undefined) return;
  const fresh = deps.parseAndExpand(witSource);
  (target as NodeUse).body = fresh as (Block | Inline)[];
}

// ---------------------------------------------------------------------------
// Prose — concatenate all text content across the tree.
// ---------------------------------------------------------------------------

function proseResult(expanded: ExpandedDocument): ProseResult {
  const parts: string[] = [];
  walkTree(expanded.children, (n) => {
    if (n.kind === 'text') parts.push(n.value);
  });
  const text = parts.join(' ');
  return {
    text,
    wordCount(): number {
      const trimmed = text.trim();
      if (trimmed === '') return 0;
      return trimmed.split(/\s+/u).length;
    },
  };
}
