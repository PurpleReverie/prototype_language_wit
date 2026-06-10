// Body-scatter sweep — extracts `<id>:<v>` tokens from a prose body and
// rewrites the body with those tokens removed. Last-wins on duplicate
// keys. The value `<v>` accepts bare scalars, quoted strings, inline
// emphasis (`_..._`, `*...*`), and any `@<id>...` node use (bare,
// parens-form, or closer-form). Emphasis and node values are detected
// by looking at the next AST sibling (the prior Text must end exactly
// in `<id>:` — no trailing whitespace).
//
// Extracted from parser-body-forms.ts to keep that file under the
// 350-line ceiling (RULES 1).
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { stripEscapes } from './parser-body-forms.js';
import type {
  Block,
  Bold,
  Inline,
  Italic,
  NodeUse,
  Param,
  Text,
} from './ast.js';
import type { Loc } from './loc.js';

export interface BodyScatterResult {
  params: Param[];
  body: (Block | Inline)[];
}

// Scan every Text node in the body for strict `<id>:<v>` tokens, lift
// them to Param[], and rewrite the text with the tokens removed. When
// `source` is provided, also lifts node-shape values via sibling-walk
// (see scatterChildren).
export function liftBodyScatter(
  body: readonly (Block | Inline)[],
  source: string = '',
): BodyScatterResult {
  const lifted = new Map<string, Param>();
  const rewritten = scatterChildren(
    body as (Block | Inline)[], lifted, source,
  );
  return { params: Array.from(lifted.values()), body: rewritten };
}

// Walk a child array in order. For each Text, scan in-text `<id>:<v>`
// matches (existing contract). Then if the residual ends with `<id>:`
// AND the next sibling is Italic/Bold/NodeUse, lift the sibling as the
// value, splice it out of the array, and trim `<id>:` from the Text.
function scatterChildren<T extends Block | Inline>(
  children: T[], lifted: Map<string, Param>, source: string,
): T[] {
  const out: T[] = [];
  for (let i = 0; i < children.length; i++) {
    const node = recurseScatter(children[i], lifted, source) as T;
    const next = i + 1 < children.length ? children[i + 1] : null;
    const sib = trySiblingLift(node, next, lifted, source);
    if (sib !== null) { out.push(sib.text as T); i += 1; continue; }
    out.push(node);
  }
  return out;
}

// Recurse into paragraph / italic / bold containers BEFORE applying the
// sibling-lift pass on this array — so nested bodies see scatter too.
function recurseScatter(
  node: Block | Inline, lifted: Map<string, Param>, source: string,
): Block | Inline {
  if (node.kind === 'text') return rewriteTextScatter(node, lifted);
  if (node.kind === 'paragraph') {
    return { ...node, children: scatterChildren(
      node.children, lifted, source) };
  }
  if (node.kind === 'italic' || node.kind === 'bold') {
    return { ...node, children: scatterChildren(
      node.children, lifted, source) };
  }
  return node;
}

function rewriteTextScatter(t: Text, lifted: Map<string, Param>): Text {
  const { text, params } = scanScatter(t.value, t.loc);
  for (const p of params) lifted.set(p.name as string, p);
  return { ...t, value: text };
}

// Match `<id>:` at the end of a Text value (with the same lookbehind
// contract: char before `<id>` is start-of-string or non-word non-`\`).
const TRAILING_KEY_RE = /(^|[^A-Za-z0-9_\\])([A-Za-z][A-Za-z0-9_-]*):$/;

interface SiblingLift { text: Block | Inline; }

// If `node` is a Text ending in `<id>:` and `next` is an adjacent
// Italic/Bold/NodeUse, lift it: store the param, return the trimmed
// Text (caller skips `next`). Otherwise return null.
function trySiblingLift(
  node: Block | Inline,
  next: Block | Inline | null,
  lifted: Map<string, Param>,
  source: string,
): SiblingLift | null {
  if (node.kind !== 'text' || next === null || source === '') return null;
  if (!isNodeValueSibling(next)) return null;
  const m = TRAILING_KEY_RE.exec(node.value);
  if (m === null) return null;
  const raw = nodeValueRawSource(next, source);
  lifted.set(m[2], { name: m[2], value: raw, loc: structuredClone(node.loc) });
  const trimmed = node.value.slice(0, node.value.length - m[2].length - 1);
  return { text: { ...node, value: stripEscapes(trimmed) } };
}

function isNodeValueSibling(
  n: Block | Inline,
): n is Italic | Bold | NodeUse {
  return n.kind === 'italic' || n.kind === 'bold' || n.kind === 'nodeUse';
}

// Extract the raw source span for the sibling. Italic/Bold and
// closer-form NodeUse use their span loc directly. Self-closing
// `@x(...)` NodeUse has `loc` covering only `@x`, so we scan the
// source from the open offset to find the matching `)`.
function nodeValueRawSource(
  n: Italic | Bold | NodeUse, source: string,
): string {
  if (n.kind === 'nodeUse' && n.closeStyle === 'parens') {
    const start = n.loc.offset;
    const end = findMatchingParen(source, start + n.loc.length);
    if (end !== -1) return source.slice(start, end + 1);
  }
  return source.slice(n.loc.offset, n.loc.offset + n.loc.length);
}

// Scan from `from` (which should be at or before `(`) and return the
// offset of the matching `)`, accounting for quoted strings with
// `\"` / `\\` escapes. Returns -1 if not found.
function findMatchingParen(source: string, from: number): number {
  let i = from;
  while (i < source.length && source.charAt(i) !== '(') i += 1;
  if (i >= source.length) return -1;
  let depth = 0;
  for (; i < source.length; i++) {
    const c = source.charAt(i);
    if (c === '"') { i = skipQuoted(source, i); continue; }
    if (c === '(') depth += 1;
    else if (c === ')') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function skipQuoted(source: string, from: number): number {
  let i = from + 1;
  while (i < source.length) {
    const c = source.charAt(i);
    if (c === '\\' && i + 1 < source.length) { i += 2; continue; }
    if (c === '"') return i;
    i += 1;
  }
  return i;
}

// In-text scatter: scan a Text value for `<id>:<v>` where `<v>` is a
// bare scalar or quoted string. Returns the residual text (tokens
// removed, surrounding lookbehind char preserved) and the lifted
// params. Last-wins handling is done by the caller via a Map.
const SCATTER_RE = /(^|[^A-Za-z0-9_\\])([A-Za-z][A-Za-z0-9_-]*):(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))/g;

interface ScanResult { text: string; params: Param[]; }

function scanScatter(input: string, loc: Loc): ScanResult {
  const params: Param[] = [];
  let out = '';
  let lastEnd = 0;
  SCATTER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCATTER_RE.exec(input)) !== null) {
    const lead = m[1];
    const key = m[2];
    const rawQuoted = m[3];
    const bareVal = m[4];
    const value = rawQuoted !== undefined ? unquoteScanned(rawQuoted) : bareVal!;
    out += input.slice(lastEnd, m.index) + lead;
    params.push({ name: key, value, loc: structuredClone(loc) });
    lastEnd = m.index + m[0].length;
  }
  out += input.slice(lastEnd);
  return { text: stripEscapes(out), params };
}

function unquoteScanned(inner: string): string {
  return inner.replace(/\\(["\\])/g, '$1');
}
