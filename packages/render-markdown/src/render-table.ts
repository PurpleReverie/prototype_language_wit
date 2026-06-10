// `@table` Markdown renderer (M10.core-vocab Thread 4).
//
// Emits a pipe-table with `---` separator after the header row. The
// authoring forms mirror the HTML renderer (inline-csv, schema-array,
// schema-record). Multi-line cell content is collapsed to spaces — for
// rich cells the author should reach for `@dl` etc.

import { tryParseCollectionFromText } from '@wit/parser';
import type {
  Collection as CollectionNode, DataValue, Inline, NodeUse, Param,
  Record as RecordNode,
} from '@wit/parser';

type InlineRenderer = (item: Inline) => string;

export function renderTableMarkdown(
  use: NodeUse, _renderInline: InlineRenderer,
): string {
  const rows = readRowsParam(use.params);
  if (rows === null) return '';
  const schema = readSchemaParam(use.params);
  const header = pickHeader(use.params, rows, schema);
  const body = pickBody(rows, schema, header.usedFromRows);
  const caption = paramOf(use.params, 'caption');
  return assemble(header.cells, body, schema, caption);
}

function assemble(
  header: string[] | null,
  body: DataValue[],
  schema: SchemaInfo | null,
  caption: string | undefined,
): string {
  const lines: string[] = [];
  if (caption !== undefined) lines.push(`**${caption}**`, '');
  const cols = pickColumnCount(header, body, schema);
  if (header !== null) {
    lines.push(toPipeRow(padCells(header, cols)));
    lines.push(toPipeRow(Array(cols).fill('---')));
  }
  for (const row of body) lines.push(toPipeRow(rowToCells(row, schema, cols)));
  return lines.join('\n');
}

function pickColumnCount(
  header: string[] | null, body: DataValue[], schema: SchemaInfo | null,
): number {
  if (schema !== null) return schema.keys.length;
  if (header !== null) return header.length;
  for (const row of body) {
    if (row.kind === 'collection') return row.items.length;
  }
  return 0;
}

function rowToCells(
  row: DataValue, schema: SchemaInfo | null, cols: number,
): string[] {
  if (row.kind === 'collection') {
    return padCells(row.items.map(asStringValueCell), cols);
  }
  if (row.kind === 'record' && schema !== null) {
    return padCells(extractByKeys(row, schema.keys), cols);
  }
  return padCells([asStringValueCell(row)], cols);
}

function padCells(cells: string[], cols: number): string[] {
  if (cells.length >= cols) return cells.slice(0, cols);
  return [...cells, ...Array(cols - cells.length).fill('')];
}

function toPipeRow(cells: readonly string[]): string {
  return '| ' + cells.map(collapseCell).join(' | ') + ' |';
}

function collapseCell(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Param + schema parsing (mirrors HTML renderer; kept local to avoid
// cross-package coupling).
// ---------------------------------------------------------------------------

interface SchemaInfo {
  keys: string[];
  labels: string[];
  isLabelled: boolean;
}

function readRowsParam(params: readonly Param[]): CollectionNode | null {
  const raw = paramOf(params, 'rows');
  if (raw === undefined || !raw.trim().startsWith('[')) return null;
  const r = tryParseCollectionFromText(raw.trim(), baseLoc(raw));
  return r === null ? null : r.collection;
}

function readSchemaParam(params: readonly Param[]): SchemaInfo | null {
  const raw = paramOf(params, 'schema');
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) return parseLabelledSchema(trimmed);
  if (trimmed.startsWith('[')) return parsePositionalSchema(trimmed);
  return null;
}

function parsePositionalSchema(text: string): SchemaInfo | null {
  const r = tryParseCollectionFromText(text, baseLoc(text));
  if (r === null) return null;
  const keys = r.collection.items.map(asStringValueCell);
  return { keys, labels: keys, isLabelled: false };
}

function parseLabelledSchema(text: string): SchemaInfo | null {
  const inner = text.replace(/^\{|\}$/g, '').trim();
  const keys: string[] = [];
  const labels: string[] = [];
  for (const field of splitTopLevel(inner)) {
    const m = /^([^-]+?)\s+-\s+(.*)$/.exec(field.trim());
    if (m === null) { keys.push(field.trim()); labels.push(field.trim()); continue; }
    keys.push(m[1]!.trim()); labels.push(m[2]!.trim());
  }
  return { keys, labels, isLabelled: true };
}

function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const c of text) {
    if (c === '{' || c === '[') depth += 1;
    else if (c === '}' || c === ']') depth -= 1;
    if (c === ',' && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim().length > 0) out.push(buf);
  return out;
}

interface HeaderPick {
  cells: string[] | null;
  usedFromRows: number;
}

function pickHeader(
  params: readonly Param[], rows: CollectionNode, schema: SchemaInfo | null,
): HeaderPick {
  const raw = paramOf(params, 'header');
  const override = pickOverride(raw, rows);
  if (override !== undefined) return override;
  if (schema !== null) return { cells: schema.labels, usedFromRows: 0 };
  return pickDefault(rows);
}

function pickOverride(
  raw: string | undefined, rows: CollectionNode,
): HeaderPick | undefined {
  if (raw === 'false') return { cells: null, usedFromRows: 0 };
  if (raw !== undefined && raw.startsWith('[')) {
    const r = tryParseCollectionFromText(raw, baseLoc(raw));
    if (r !== null) {
      return { cells: r.collection.items.map(asStringValueCell), usedFromRows: 0 };
    }
  }
  if (raw !== undefined && /^\d+$/.test(raw)) {
    const i = parseInt(raw, 10);
    const row = rows.items[i];
    if (row !== undefined && row.kind === 'collection') {
      return { cells: row.items.map(asStringValueCell), usedFromRows: i + 1 };
    }
  }
  return undefined;
}

function pickDefault(rows: CollectionNode): HeaderPick {
  if (rows.items.length === 0) return { cells: null, usedFromRows: 0 };
  const first = rows.items[0];
  if (first === undefined || first.kind !== 'collection') {
    return { cells: null, usedFromRows: 0 };
  }
  return { cells: first.items.map(asStringValueCell), usedFromRows: 1 };
}

function pickBody(
  rows: CollectionNode, schema: SchemaInfo | null, skip: number,
): DataValue[] {
  if (schema !== null) return rows.items;
  return rows.items.slice(skip);
}

function extractByKeys(rec: RecordNode, keys: readonly string[]): string[] {
  return keys.map((k) => {
    const f = rec.fields.find((x) => x.key === k);
    return f === undefined ? '' : asStringValueCell(f.value);
  });
}

function paramOf(params: readonly Param[], name: string): string | undefined {
  for (const p of params) if (p.name === name) return p.value;
  return undefined;
}

function asStringValueCell(v: DataValue): string {
  if (v.kind === 'stringValue') return v.value;
  if (v.kind === 'numberValue') return String(v.value);
  if (v.kind === 'booleanValue') return String(v.value);
  return '';
}

function baseLoc(text: string) {
  return { file: '', line: 1, col: 1, offset: 0, length: text.length };
}
