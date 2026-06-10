// Implicit-capture inference (M10.core-vocab Thread 1).
//
// When a `#name` definition omits the explicit `||a, b, c||` capture
// list, scan the body for `::ident::` interpolations and collect the
// distinct names in source order. The result feeds NodeDef.captures so
// the resolver/expander can bind use-site params the same way as when
// captures are explicit.

import type {
  Block, Collection as CollectionNode, Inline, Record as RecordNode,
} from './ast.js';

// `null` ⇒ captures were absent from source (`#x body x#` or `#x: v !!`).
// `[]`   ⇒ captures were explicit empty `||||`.
// `[a,b]` ⇒ explicit non-empty.
export type CaptureList = string[] | null;

export function resolveCaptures(
  explicit: CaptureList,
  body: readonly (Block | Inline | RecordNode | CollectionNode)[],
): string[] {
  if (explicit !== null) return explicit;
  return gatherCapturesFromBody(body);
}

export function gatherCapturesFromBody(
  body: readonly (Block | Inline | RecordNode | CollectionNode)[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const node of body) walkNode(node, seen, out);
  return out;
}

function walkNode(
  node: Block | Inline | RecordNode | CollectionNode,
  seen: Set<string>,
  out: string[],
): void {
  const kind = (node as { kind: string }).kind;
  if (kind === 'interpolation') {
    addName((node as { name: string }).name, seen, out);
    return;
  }
  if (kind === 'paragraph' || kind === 'italic' || kind === 'bold') {
    walkChildren((node as { children: Inline[] }).children, seen, out);
    return;
  }
  if (kind === 'nodeUse') walkNodeUse(node as { body: unknown }, seen, out);
  if (kind === 'ifStatement') walkIf(node as IfLike, seen, out);
  if (kind === 'eachStatement') walkChildren(
    (node as { body: Block[] }).body, seen, out,
  );
}

interface IfLike {
  then: Block[];
  else?: Block[];
}

function walkIf(node: IfLike, seen: Set<string>, out: string[]): void {
  walkChildren(node.then, seen, out);
  if (node.else !== undefined) walkChildren(node.else, seen, out);
}

function walkNodeUse(
  node: { body: unknown }, seen: Set<string>, out: string[],
): void {
  const body = node.body;
  if (!Array.isArray(body)) return;
  walkChildren(body, seen, out);
}

function walkChildren(
  items: readonly unknown[], seen: Set<string>, out: string[],
): void {
  for (const it of items) {
    walkNode(it as Block | Inline | RecordNode | CollectionNode, seen, out);
  }
}

function addName(name: string, seen: Set<string>, out: string[]): void {
  if (seen.has(name)) return;
  seen.add(name);
  out.push(name);
}
