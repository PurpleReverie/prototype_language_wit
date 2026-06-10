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
  Param,
  Loc,
  Text,
} from '@wit/parser';
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
  return source === 'record';
}

export function expandNodeDef(args: ExpandDefArgs): Splice {
  const env = isFieldKeyed(args.use.paramsSource)
    ? buildRecordCaptureEnv(args.use, args.def)
    : buildCaptureEnv(args.def.captures, args.use.params);
  const body = args.use.body ?? [];
  const cloned = structuredClone(args.def.body) as (Block | Inline)[];
  return substituteAll(cloned, env, body);
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
    const value = env.get(item.name) ?? '';
    return [textNode(value, item.loc)];
  }
  if (item.kind === 'bodySlot') {
    return structuredClone(bodyContent) as (Block | Inline)[];
  }
  return [substituteContainer(item, env, bodyContent)];
}

function substituteContainer(
  item: Block | Inline,
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): Block | Inline {
  if (item.kind === 'paragraph') {
    return { ...item, children: substituteInlines(item.children, env, bodyContent) };
  }
  if (item.kind === 'italic' || item.kind === 'bold') {
    return { ...item, children: substituteInlines(item.children, env, bodyContent) };
  }
  if (item.kind === 'nodeUse' && item.body !== null) {
    const newBody = substituteAll(item.body, env, bodyContent);
    return { ...item, body: newBody };
  }
  return item;
}

function substituteInlines(
  items: readonly Inline[],
  env: Map<string, string>,
  bodyContent: readonly (Block | Inline)[],
): Inline[] {
  const out: Inline[] = [];
  for (const item of items) {
    for (const s of substituteOne(item, env, bodyContent)) {
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

