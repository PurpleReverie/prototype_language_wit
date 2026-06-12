// `wit tour <file>` — parse the given .wit file and print the AST as a
// readable indented tree. Sister to `wit parse`, which emits raw JSON.
//
// Output is one node per line: `<connectors><kind> <inline summary>`.
// Tree connectors (`├──`, `└──`, `│`) make the structure scannable. The
// walker is recursive and dispatches on `kind`. Param children of a
// `nodeUse` and field children of a `record` are surfaced as virtual
// "param"/"field" rows so the tree reflects everything in one view.
//
// Default output is a self-contained report: header (file + source
// stats + parse time), tree, footer (AST coverage summary). Pass
// `--no-report` to emit just the tree (useful for piping). Pass
// `--report` to force the report mode even on a non-TTY stdout.

import * as fs from 'node:fs';
import { parse, WitError } from '@wit/parser';
import type { CliIo } from './bin.js';

// Every `kind:` discriminator the parser can emit. Used to compute the
// "AST kinds seen: X/Y" coverage line in the footer.
const ALL_AST_KINDS: ReadonlyArray<string> = [
  'document', 'paragraph', 'comment', 'reference',
  'text', 'italic', 'bold', 'interpolation', 'bodySlot',
  'nodeUse', 'nodeDef', 'dataDef',
  'record', 'collection',
  'ifStatement', 'eachStatement',
  'scriptBlock', 'scriptCall',
  'existenceCondition', 'comparisonCondition',
  'stringValue', 'numberValue', 'booleanValue', 'nullValue',
];

interface TourOptions {
  file: string;
  report: boolean;
}

export function runTour(args: readonly string[], io: CliIo): number {
  const opts = parseArgs(args, io);
  if (opts === null) return 2;
  const source = readOrFail(opts.file, io);
  if (source === null) return 1;
  try {
    const t0 = Date.now();
    const doc = parse(source, opts.file);
    const elapsedMs = Date.now() - t0;
    const tree = renderTree(doc);
    if (opts.report) {
      // Emit the whole report in a single write so it lands atomically
      // before the process exits — multiple writes on a piped stdout
      // can race with `process.exit`.
      io.stdout(
        renderHeader(opts.file, source, elapsedMs) + tree + '\n' +
        renderFooter(doc),
      );
    } else {
      io.stdout(tree + '\n');
    }
    return 0;
  } catch (err) {
    io.stderr(formatError(err, opts.file));
    return 1;
  }
}

function parseArgs(args: readonly string[], io: CliIo): TourOptions | null {
  let file: string | undefined;
  let report = defaultReport();
  for (const a of args) {
    if (a === '--report') { report = true; continue; }
    if (a === '--no-report') { report = false; continue; }
    if (a.startsWith('--')) {
      io.stderr(`wit tour: unknown option "${a}"\n`);
      return null;
    }
    if (file === undefined) { file = a; continue; }
    io.stderr(`wit tour: unexpected argument "${a}"\n`);
    return null;
  }
  if (file === undefined) {
    io.stderr('wit tour: missing <file> argument\n');
    return null;
  }
  return { file, report };
}

function defaultReport(): boolean {
  // Default to report-on for human viewing. Tests / piping can opt out
  // with --no-report or by setting WIT_TOUR_NO_REPORT=1.
  if (process.env.WIT_TOUR_NO_REPORT === '1') return false;
  return process.stdout?.isTTY === true || process.env.WIT_TOUR_REPORT === '1';
}

// ---------------------------------------------------------------------------
// Report header / footer.
// ---------------------------------------------------------------------------

function renderHeader(file: string, source: string, elapsedMs: number): string {
  const bytes = Buffer.byteLength(source, 'utf8');
  const lines = source.split('\n').length;
  return [
    'Wit feature tour',
    '================',
    `File: ${file}`,
    `Source: ${bytes} bytes, ${lines} lines`,
    `Parsed in: ${elapsedMs}ms`,
    '',
  ].join('\n');
}

function renderFooter(doc: unknown): string {
  const kinds = collectKinds(doc);
  const sortedSeen = [...kinds].sort();
  const missing = ALL_AST_KINDS.filter((k) => !kinds.has(k)).sort();
  const useVariants = collectStrings(doc, 'nodeUse', 'paramsSource');
  const defShapes = collectStrings(doc, 'nodeDef', 'shape');
  const lines = [
    '',
    '================',
    'Summary',
    `  AST kinds seen: ${kinds.size}/${ALL_AST_KINDS.length}`,
    `  Kinds: ${sortedSeen.join(', ')}`,
    `  NodeUse paramsSource variants: ${[...useVariants].sort().join(', ') || '(none)'}`,
    `  NodeDef shapes: ${[...defShapes].sort().join(', ') || '(none)'}`,
    `  Errors: 0`,
  ];
  if (missing.length > 0) {
    lines.push(`  Missing kinds: ${missing.join(', ')}`);
  }
  lines.push('');
  return lines.join('\n');
}

function collectKinds(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) collectKinds(child, acc);
    return acc;
  }
  if (node === null || typeof node !== 'object') return acc;
  const n = node as Record<string, unknown>;
  if (typeof n.kind === 'string') acc.add(n.kind);
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'kind') continue;
    collectKinds(n[key], acc);
  }
  return acc;
}

function collectStrings(
  node: unknown,
  kindFilter: string,
  field: string,
  acc: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) collectStrings(child, kindFilter, field, acc);
    return acc;
  }
  if (node === null || typeof node !== 'object') return acc;
  const n = node as Record<string, unknown>;
  if (n.kind === kindFilter && typeof n[field] === 'string') {
    acc.add(n[field] as string);
  }
  for (const key of Object.keys(n)) {
    if (key === 'loc' || key === 'kind') continue;
    collectStrings(n[key], kindFilter, field, acc);
  }
  return acc;
}

function readOrFail(file: string, io: CliIo): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    io.stderr(`wit tour: cannot read ${file}: ${(err as Error).message}\n`);
    return null;
  }
}

function formatError(err: unknown, file: string): string {
  if (err instanceof WitError) {
    const { line, col } = err.loc;
    return `${file}:${line}:${col}: ${err.code}: ${err.message}\n`;
  }
  return `wit tour: ${(err as Error).message ?? String(err)}\n`;
}

// ---------------------------------------------------------------------------
// Tree rendering.
// ---------------------------------------------------------------------------

interface Line { ancestorsLast: boolean[]; isLast: boolean; text: string; isRoot: boolean }

export function renderTree(doc: unknown): string {
  const lines: Line[] = [];
  walk(doc, lines, [], true, true);
  return lines.map(formatLine).join('\n');
}

function formatLine(l: Line): string {
  if (l.isRoot) return l.text;
  let prefix = '';
  for (const last of l.ancestorsLast) prefix += last ? '    ' : '│   ';
  prefix += l.isLast ? '└── ' : '├── ';
  return prefix + l.text;
}

// ---------------------------------------------------------------------------
// Walker.
// ---------------------------------------------------------------------------

function walk(
  node: unknown,
  out: Line[],
  ancestors: boolean[],
  isLast: boolean,
  isRoot: boolean,
): void {
  if (node === null || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  out.push({ ancestorsLast: ancestors, isLast, isRoot, text: summarize(n) });
  const children = childrenOf(n);
  const nextAncestors = isRoot ? [] : [...ancestors, isLast];
  for (let i = 0; i < children.length; i++) {
    walk(children[i], out, nextAncestors, i === children.length - 1, false);
  }
}

// ---------------------------------------------------------------------------
// One-line summary per node kind.
// ---------------------------------------------------------------------------

function summarize(n: Record<string, unknown>): string {
  const kind = typeof n.kind === 'string' ? n.kind : '<no-kind>';
  switch (kind) {
    case 'document': return 'document';
    case 'paragraph': return 'paragraph';
    case 'text': return `text ${jsonStr(asString(n.value), 40)}`;
    case 'italic': return 'italic';
    case 'bold': return 'bold';
    case 'interpolation': return `interpolation ::${asString(n.name)}::`;
    case 'bodySlot': return 'bodySlot';
    case 'comment': return summarizeComment(n);
    case 'reference': return `reference ${jsonStr(asString(n.path), 60)}`;
    case 'nodeUse': return summarizeNodeUse(n);
    case 'nodeDef': return summarizeNodeDef(n);
    case 'dataDef': return summarizeDataDef(n);
    case 'record': return summarizeRecord(n);
    case 'collection': return summarizeCollection(n);
    case 'ifStatement': return summarizeIf(n);
    case 'eachStatement': return summarizeEach(n);
    case 'scriptBlock': return `scriptBlock ${jsonStr(asString(n.content), 40)}`;
    case 'scriptCall': return summarizeScriptCall(n);
    case 'existenceCondition': return `existenceCondition @${pathSegs(n.path)}`;
    case 'comparisonCondition': return summarizeComparison(n);
    case 'stringValue': return `stringValue ${jsonStr(asString(n.value), 40)}`;
    case 'numberValue': return `numberValue ${String(n.value)}`;
    case 'booleanValue': return `booleanValue ${String(n.value)}`;
    case 'nullValue': return 'nullValue';
    case 'param': return summarizeParam(n);
    case 'field': return `field "${asString(n.key)}"`;
    default: return kind;
  }
}

function summarizeComment(n: Record<string, unknown>): string {
  const style = n.inline === true ? 'inline' : 'line';
  return `comment (${style}, ${jsonStr(asString(n.text), 40)})`;
}

function summarizeNodeUse(n: Record<string, unknown>): string {
  const access = Array.isArray(n.access) && n.access.length > 0
    ? '.' + (n.access as string[]).join('.')
    : '';
  const src = asString(n.paramsSource);
  const params = Array.isArray(n.params) ? n.params.length : 0;
  return `nodeUse @${asString(n.name)}${access} [paramsSource: ${src}, params: ${params}]`;
}

function summarizeNodeDef(n: Record<string, unknown>): string {
  const prefix = n.additive === true ? '+#' : '#';
  const shape = asString(n.shape);
  const caps = Array.isArray(n.captures) ? (n.captures as string[]).join(',') : '';
  const capsPart = caps.length > 0 ? `, captures: ${caps}` : '';
  return `nodeDef ${prefix}${asString(n.name)} [shape: ${shape}${capsPart}]`;
}

function summarizeDataDef(n: Record<string, unknown>): string {
  const v = n.value as { kind?: unknown } | undefined;
  const t = typeof v?.kind === 'string' ? v.kind : '<unknown>';
  return `dataDef #${asString(n.name)} [type: ${t}]`;
}

function summarizeRecord(n: Record<string, unknown>): string {
  const fields = Array.isArray(n.fields) ? n.fields as { key: string }[] : [];
  const keys = fields.map((f) => f.key).join(',');
  return `record [keys: ${keys}]`;
}

function summarizeCollection(n: Record<string, unknown>): string {
  const items = Array.isArray(n.items) ? n.items.length : 0;
  return `collection [length: ${items}]`;
}

function summarizeIf(n: Record<string, unknown>): string {
  const cond = n.cond as { kind?: unknown } | undefined;
  const kind = typeof cond?.kind === 'string' ? cond.kind : '<unknown>';
  const tag = kind === 'comparisonCondition' ? 'comparison' : 'existence';
  const hasElse = Array.isArray(n.else) && (n.else as unknown[]).length > 0;
  return `ifStatement [${tag}${hasElse ? ', else' : ''}]`;
}

function summarizeEach(n: Record<string, unknown>): string {
  const col = n.collection as { segments?: unknown } | undefined;
  const segs = Array.isArray(col?.segments) ? (col.segments as string[]).join('.') : '';
  return `eachStatement @${segs} as ${asString(n.itemName)}`;
}

function summarizeScriptCall(n: Record<string, unknown>): string {
  const args = Array.isArray(n.args) ? (n.args as string[]).join(', ') : '';
  return `scriptCall ${asString(n.fnName)}(${args})`;
}

function summarizeComparison(n: Record<string, unknown>): string {
  const left = pathSegs(n.left);
  const op = asString(n.op);
  const right = n.right as { value?: unknown } | undefined;
  const rv = right?.value !== undefined ? String(right.value) : '<?>';
  return `comparisonCondition @${left} ${op} ${jsonStr(rv, 30)}`;
}

function summarizeParam(n: Record<string, unknown>): string {
  const name = typeof n.name === 'string' ? n.name : null;
  const value = asString(n.value);
  if (name === null) return `param positional value=${jsonStr(value, 40)}`;
  return `param name="${name}" value=${jsonStr(value, 40)}`;
}

// ---------------------------------------------------------------------------
// Children discovery per kind. Synthetic `param`/`field` nodes are
// inserted so the tree reflects nodeUse parameters and record fields.
// ---------------------------------------------------------------------------

function childrenOf(n: Record<string, unknown>): unknown[] {
  const kind = typeof n.kind === 'string' ? n.kind : '';
  switch (kind) {
    case 'document':
    case 'paragraph':
    case 'italic':
    case 'bold': return arr(n.children);
    case 'nodeUse': return [...paramChildren(n), ...arr(n.body)];
    case 'nodeDef': return arr(n.body);
    case 'dataDef': return n.value !== undefined ? [n.value] : [];
    case 'record': return recordFieldChildren(n);
    case 'collection': return arr(n.items);
    case 'ifStatement': return ifChildren(n);
    case 'eachStatement': return arr(n.body);
    case 'comparisonCondition': return n.right !== undefined ? [n.right] : [];
    case 'field': return n.value !== undefined ? [n.value] : [];
    default: return [];
  }
}

function paramChildren(n: Record<string, unknown>): unknown[] {
  const params = Array.isArray(n.params) ? n.params as Record<string, unknown>[] : [];
  return params.map((p) => ({ kind: 'param', name: p.name, value: p.value }));
}

function recordFieldChildren(n: Record<string, unknown>): unknown[] {
  const fields = Array.isArray(n.fields) ? n.fields as { key: string; value: unknown }[] : [];
  return fields.map((f) => ({ kind: 'field', key: f.key, value: f.value }));
}

function ifChildren(n: Record<string, unknown>): unknown[] {
  const out: unknown[] = [];
  if (n.cond !== undefined) out.push(n.cond);
  for (const c of arr(n.then)) out.push(c);
  for (const c of arr(n.else)) out.push(c);
  return out;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function arr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}

function asString(x: unknown): string {
  return typeof x === 'string' ? x : '';
}

function pathSegs(x: unknown): string {
  const segs = (x as { segments?: unknown } | undefined)?.segments;
  return Array.isArray(segs) ? (segs as string[]).join('.') : '';
}

function jsonStr(s: string, max: number): string {
  const trimmed = s.length > max ? s.slice(0, max) + '…' : s;
  return JSON.stringify(trimmed);
}
