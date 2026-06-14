// Inline NodeDef expansion helpers used by the expander pass.
//
// Given a NodeUse bound to a NodeDef, the expander asks this module for
// the spliced node sequence that replaces the use. Steps:
//   1. Build a capture environment by zipping use-site params against the
//      def's captures (positional args fill in order; named params
//      override by name).
//   2. Walk a deep clone of the def's body, replacing:
//        - Interpolation nodes (`::name::`) with the captured value's
//          Text node (or an empty Text if unbound).
//        - BodySlot nodes (`...`) with the use-site body (a list of
//          Block | Inline items).
//      Any nested NodeUse inside the def's body remains for the caller
//      to expand recursively — we never recurse here, the caller's
//      walker does.
//
// A NodeUse bound to a DataDef resolves to the data value reached via
// the use's `access` path. For terminal scalars (string/number/boolean)
// we emit a Text node. Container values without an access path are
// deferred (M1.11 iteration scope) — the use stays in the output for a
// later iteration pass to handle.
//
// Loop guard lives in expander.ts; this module is purely a transformer.

import type {
  Block,
  Inline,
  NodeUse,
  NodeDef,
  DataValue,
  Paragraph,
  Param,
  Loc,
  Text,
} from '@witlang/parser';
import { parse } from '@witlang/parser';
import { lookupRecordField } from './canonical-key.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';

export type Splice = (Block | Inline)[];

// ---------------------------------------------------------------------------
// NodeDef expansion.
// ---------------------------------------------------------------------------

export interface ExpandDefArgs {
  use: NodeUse;
  def: NodeDef;
}

function isFieldKeyed(source: NodeUse['paramsSource']): boolean {
  return source === 'record' || source === 'form-fill';
}

export function expandNodeDef(args: ExpandDefArgs): Splice {
  const env = isFieldKeyed(args.use.paramsSource)
    ? buildRecordCaptureEnv(args.use, args.def)
    : buildCaptureEnv(args.def.captures, args.use.params);
  // W-9: bodySlot is a def-side marker. Any `...` in the USE's body is
  // literal content and must not be re-substituted when the def-side
  // bodySlot splices the use body in. Convert use-body bodySlots to
  // literal text `...` before substitution.
  const body = literalizeBodySlots(args.use.body ?? []);
  const cloned = structuredClone(args.def.body) as (Block | Inline)[];
  return substituteAll(cloned, env, body);
}

// W-9: recursively replace bodySlot inline nodes inside a use's body
// with a Text("...") node. Preserves locs so error messages stay
// anchored. Doesn't touch bodySlots inside NodeDefs nested in the
// body (they own their own def-side semantics).
function literalizeBodySlots(
  items: readonly (Block | Inline)[],
): (Block | Inline)[] {
  return items.map((it) => literalizeOne(it));
}

function literalizeOne(item: Block | Inline): Block | Inline {
  if (item.kind === 'bodySlot') {
    return { kind: 'text', value: '...', loc: structuredClone(item.loc) };
  }
  if (item.kind === 'paragraph') {
    return { ...item, children: item.children.map((c) =>
      literalizeOne(c) as Inline) };
  }
  if (item.kind === 'italic' || item.kind === 'bold') {
    return { ...item, children: item.children.map((c) =>
      literalizeOne(c) as Inline) };
  }
  if (item.kind === 'nodeUse' && item.body !== null) {
    return { ...item, body: literalizeBodySlots(item.body) };
  }
  return item;
}

function buildCaptureEnv(
  captures: readonly string[],
  params: readonly Param[],
): Map<string, string> {
  const env = new Map<string, string>();
  let posIdx = 0;
  for (const p of params) {
    if (p.name === null) {
      const target = captures[posIdx++];
      if (target !== undefined) env.set(target, p.value);
      continue;
    }
    env.set(p.name, p.value);
  }
  return env;
}

// M13.records-as-args: record-arg bindings are field-keyed (not
// positional). Missing field → E_MISSING_RECORD_FIELD. Extra field →
// E_EXTRA_RECORD_FIELD. Both surface with the offending field name and
// the template handle in the message.
function buildRecordCaptureEnv(use: NodeUse, def: NodeDef): Map<string, string> {
  const fieldByName = new Map<string, Param>();
  for (const p of use.params) if (p.name !== null) fieldByName.set(p.name, p);
  const env = new Map<string, string>();
  for (const cap of def.captures) {
    const field = fieldByName.get(cap);
    if (field === undefined) {
      throw new ExpanderError(
        RuntimeErrorCode.E_MISSING_RECORD_FIELD,
        `missing record field "${cap}" for template @${def.name}`,
        use.loc,
      );
    }
    env.set(cap, field.value);
  }
  const declared = new Set(def.captures);
  for (const p of use.params) {
    if (p.name !== null && !declared.has(p.name)) {
      throw new ExpanderError(
        RuntimeErrorCode.E_EXTRA_RECORD_FIELD,
        `extra record field "${p.name}" not declared by template @${def.name}`,
        p.loc,
      );
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// Substitute Interpolation + BodySlot across a body.
// ---------------------------------------------------------------------------

function substituteAll(
  items: readonly (Block | Inline)[],
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  for (const item of items) {
    for (const s of substituteOne(item, env, bodyContent)) out.push(s);
  }
  return out;
}

function substituteOne(
  item: Block | Inline,
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): (Block | Inline)[] {
  if (item.kind === 'interpolation') {
    return expandInterpolationValue(env.get(item.name) ?? '', item.loc);
  }
  if (item.kind === 'bodySlot') {
    // W-3a: trim leading/trailing whitespace from the body content's
    // first/last Text nodes before splicing. The use-site syntax
    // `@x Yell x@` carries spaces around `Yell` from the prose lex,
    // which would survive into the def's `*...*` wrap as `* Yell *`.
    return trimBodyEdges(structuredClone(bodyContent) as (Block | Inline)[]);
  }
  if (item.kind === 'paragraph') {
    return substituteParagraph(item, env, bodyContent);
  }
  return [substituteContainer(item, env, bodyContent)];
}

// M17.block-aware-capture-substitution: re-parse a captured raw-string
// value as a FULL document (not just inline). The form-fill / pipe /
// parens / record-arg parser captures values verbatim (per M15-followup),
// so emphasis markers, `@-refs`, headings, lists, and paragraph breaks
// all remain literal in the captured string. At expand time we re-run
// the full parser so block-level constructs (`@h1 ... h1@`, lists,
// tables, multi-paragraph prose) become real AST nodes instead of
// flattening to literal text.
//
// Splicing rules (the caller decides positional fit):
//   - Empty value → empty splice (no-op).
//   - Single-paragraph value → that paragraph's inlines (back-compat with
//     the prior `parseInlineFromText` behaviour at inline sites).
//   - Single non-paragraph block → that block alone.
//   - Multi-block value → all blocks as a sequence.
// At an inline site (inside a Paragraph), the enclosing Paragraph is
// split around any Block-kinded items by `substituteParagraph`. At a
// strict inline-only site (inside `_emphasis_` / `*bold*`), only inline
// content from the first parsed paragraph is taken — block-shaped
// content there is a context mismatch and is dropped.
//
// Edge cases:
//   - Pure plain text → single Text node, unchanged from prior behaviour.
//   - `_x_` / `*x*` → Italic / Bold nodes, unchanged from prior behaviour.
//   - `@ref` → NodeUse, which the caller's walker will recursively expand.
//   - `<% expr %>` → ScriptBlock — handled by the script-runner phase.
function expandInterpolationValue(value: string, loc: Loc): (Block | Inline)[] {
  if (value.length === 0) return [];
  const doc = parse(value, loc.file);
  if (doc.children.length === 0) return [textNode(value, loc)];
  if (doc.children.length === 1 && doc.children[0]!.kind === 'paragraph') {
    return (doc.children[0] as Paragraph).children as (Block | Inline)[];
  }
  return doc.children as (Block | Inline)[];
}

function substituteContainer(
  item: Block | Inline,
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): Block | Inline {
  if (item.kind === 'italic' || item.kind === 'bold') {
    return { ...item, children: substituteInlines(item.children, env, bodyContent) };
  }
  if (item.kind === 'nodeUse' && item.body !== null) {
    const newBody = substituteAll(item.body, env, bodyContent);
    return { ...item, body: newBody };
  }
  return item;
}

// Substitute interpolations inside a Paragraph's children. If any
// interpolation expands to a Block-kinded item (e.g. a captured value
// that parsed as `@h1 ... h1@` or as multiple paragraphs), the enclosing
// Paragraph is split into a sequence of blocks around those items —
// inline runs are re-wrapped in fresh Paragraphs that carry the original
// loc. If no Block items appear the original Paragraph shape is preserved.
function substituteParagraph(
  p: Paragraph,
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): (Block | Inline)[] {
  const mixed: (Block | Inline)[] = [];
  for (const child of p.children) {
    for (const s of substituteOne(child, env, bodyContent)) mixed.push(s);
  }
  if (!mixed.some((n) => isBlockShape(n))) {
    return [{ ...p, children: mixed as Inline[] }];
  }
  return liftMixedToBlocks(mixed, p.loc);
}

function isBlockShape(node: Block | Inline): boolean {
  return BLOCK_KINDS.has(node.kind);
}

const BLOCK_KINDS = new Set<string>([
  'paragraph',
  'comment',
  'nodeDef',
  'dataDef',
  'reference',
  'ifStatement',
  'eachStatement',
  'scriptBlock',
]);

// Lift a mixed sequence of Block/Inline items into a flat Block[]: runs
// of inlines re-wrap into a Paragraph (carrying the original paragraph
// loc), block items emit on their own. Mirrors the `spliceAsBlocks`
// helper in expander.ts but operates locally during template
// substitution before the expander walks the splice.
function liftMixedToBlocks(
  mixed: readonly (Block | Inline)[],
  loc: Loc,
): (Block | Inline)[] {
  const out: (Block | Inline)[] = [];
  let run: Inline[] = [];
  const flush = (): void => {
    if (run.length === 0) return;
    out.push({ kind: 'paragraph', children: run, loc: structuredClone(loc) });
    run = [];
  };
  for (const node of mixed) {
    if (isBlockShape(node)) {
      flush();
      out.push(node);
    } else {
      run.push(node as Inline);
    }
  }
  flush();
  return out;
}

// Substitute inlines at a strict inline-only site (inside emphasis).
// Any block-shaped items from a capture expansion are dropped here —
// emphasis can't contain block content — to keep the AST well-formed.
function substituteInlines(
  items: readonly Inline[],
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): Inline[] {
  const out: Inline[] = [];
  for (const item of items) {
    for (const s of substituteOne(item, env, bodyContent)) {
      if (isBlockShape(s)) continue;
      out.push(s as Inline);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// DataDef / iteration-item resolution.
// ---------------------------------------------------------------------------

export function expandDataValue(use: NodeUse, root: DataValue): Splice | null {
  const access = use.access ?? [];
  const value = walkAccess(root, access);
  if (value === null) return null;
  // M17: re-parse string values as full documents so block-level content
  // (headings, lists, multiple paragraphs) inside a captured field
  // renders as real blocks at block positions and as inline at inline
  // positions. The caller (expander.ts) does positional splicing.
  if (value.kind === 'stringValue') {
    return expandInterpolationValue(value.value, use.loc);
  }
  const rendered = renderTerminal(value, use.loc);
  if (rendered === null) return null;
  return [rendered];
}

function walkAccess(
  value: DataValue,
  segments: readonly string[],
): DataValue | null {
  let current: DataValue = value;
  for (const seg of segments) {
    if (current.kind !== 'record') return null;
    const found = lookupRecordField(current, seg);
    if (found === undefined) return null;
    current = found;
  }
  return current;
}

function renderTerminal(value: DataValue, loc: Loc): Text | null {
  if (value.kind === 'stringValue') return textNode(value.value, loc);
  if (value.kind === 'numberValue') return textNode(String(value.value), loc);
  if (value.kind === 'booleanValue') return textNode(String(value.value), loc);
  if (value.kind === 'nullValue') return textNode('', loc);
  // Container without access — deferred per M1.11.
  return null;
}

function textNode(value: string, loc: Loc): Text {
  return { kind: 'text', value, loc: structuredClone(loc) };
}

// W-3a: trim leading/trailing whitespace on the first/last Text nodes
// of a body-slot splice. Recurses into a leading/trailing Paragraph so
// `@x Yell x@` → `[Paragraph([Text("Yell")])]` not `[Paragraph([Text(" Yell ")])]`.
// Drops empty Text nodes at the edges.
function trimBodyEdges(items: (Block | Inline)[]): (Block | Inline)[] {
  if (items.length === 0) return items;
  trimLeading(items);
  trimTrailing(items);
  return items;
}

function trimLeading(items: (Block | Inline)[]): void {
  while (items.length > 0) {
    const first = items[0]!;
    if (first.kind === 'text') {
      const trimmed = (first as Text).value.replace(/^[ \t\n]+/, '');
      if (trimmed.length === 0) { items.shift(); continue; }
      (first as Text).value = trimmed;
      return;
    }
    if (first.kind === 'paragraph') {
      trimLeading((first as Paragraph).children as (Block | Inline)[]);
      return;
    }
    return;
  }
}

function trimTrailing(items: (Block | Inline)[]): void {
  while (items.length > 0) {
    const last = items[items.length - 1]!;
    if (last.kind === 'text') {
      const trimmed = (last as Text).value.replace(/[ \t\n]+$/, '');
      if (trimmed.length === 0) { items.pop(); continue; }
      (last as Text).value = trimmed;
      return;
    }
    if (last.kind === 'paragraph') {
      trimTrailing((last as Paragraph).children as (Block | Inline)[]);
      return;
    }
    return;
  }
}

