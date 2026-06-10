// `@table` HTML renderer (M10.core-vocab Thread 4).
//
// Supports three authoring forms:
//   1. Inline CSV-style: `|rows [[Header,...], [Row1,...], ...]|`
//   2. Records with positional schema: `|schema [k1, k2]| |rows [...]|`
//   3. Records with labelled schema: `|schema { k - Label, ... }| |rows [...]|`
//
// `|caption ...|` adds a `<caption>` element.
// `|header N|`, `|header false|`, `|header [a,b,c]|` override the
// default "row 0 of rows is the header" behaviour.
//
// Row values may be parsed Records (when `|rows @sites|` was inlined as
// a Collection of Records by the resolver) or strings (CSV style).

import {
  tryParseCollectionFromText,
} from '@wit/parser';
import type {
  Block, Collection as CollectionNode, DataValue, Inline,
  NodeUse, Param, Record as RecordNode,
} from '@wit/parser';
import { escapeHtml } from './escape.js';

type InlineRenderer = (items: readonly Inline[]) => string;
type BlockRenderer = (blocks: readonly Block[]) => string;

export function tryRenderTable(
  use: NodeUse,
  _renderInlines: InlineRenderer,
  _renderBlocks: BlockRenderer,
): string | null {
  if (use.name !== 'table') return null;
  const rows = readRowsParam(use.params);
  if (rows === null) return '<table></table>';
  const schema = readSchemaParam(use.params);
  const header = pickHeader(use.params, rows, schema);
  const body = pickBody(rows, schema, header.usedFromRows);
  const caption = paramOf(use.params, 'caption');
  return renderHtmlTable(header.cells, body, schema, caption);
}

// ---------------------------------------------------------------------------
// Param parsing.
// ---------------------------------------------------------------------------

function readRowsParam(params: readonly Param[]): CollectionNode | null {
  const raw = paramOf(params, 'rows');
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return null;
  const r = tryParseCollectionFromText(
    trimmed,
    { file: '', line: 1, col: 1, offset: 0, length: trimmed.length },
  );
  return r === null ? null : r.collection;
}

interface SchemaInfo {
  keys: string[];                 // record field keys
  labels: string[];               // display labels
  isLabelled: boolean;
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
  const keys = r.collection.items.map(asStringValue);
  return { keys, labels: keys, isLabelled: false };
}

function parseLabelledSchema(text: string): SchemaInfo | null {
  // Reuse the record parser by wrapping text directly.
  // Note: we go through the collection parser indirectly by quick-parsing.
  // Instead, parse a leading `{ ... }` here — simple split.
  const inner = text.replace(/^\{|\}$/g, '').trim();
  const keys: string[] = [];
  const labels: string[] = [];
  for (const field of splitTopLevel(inner, ',')) {
    const m = /^([^-]+?)\s+-\s+(.*)$/.exec(field.trim());
    if (m === null) { keys.push(field.trim()); labels.push(field.trim()); continue; }
    keys.push(m[1]!.trim());
    labels.push(m[2]!.trim());
  }
  return { keys, labels, isLabelled: true };
}

function splitTopLevel(text: string, sep: ','): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const c of text) {
    if (c === '{' || c === '[') depth += 1;
    else if (c === '}' || c === ']') depth -= 1;
    if (c === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += c;
  }
  if (buf.trim().length > 0) out.push(buf);
  return out;
}

// ---------------------------------------------------------------------------
// Header / body partitioning.
// ---------------------------------------------------------------------------

interface HeaderPick {
  cells: string[] | null;
  usedFromRows: number;            // count of rows consumed for header
}

function pickHeader(
  params: readonly Param[],
  rows: CollectionNode,
  schema: SchemaInfo | null,
): HeaderPick {
  const raw = paramOf(params, 'header');
  const override = pickHeaderOverride(raw, rows);
  if (override !== undefined) return override;
  if (schema !== null) return { cells: schema.labels, usedFromRows: 0 };
  return pickDefaultHeader(rows);
}

function pickHeaderOverride(
  raw: string | undefined, rows: CollectionNode,
): HeaderPick | undefined {
  if (raw === 'false') return { cells: null, usedFromRows: 0 };
  if (raw !== undefined && raw.startsWith('[')) {
    const r = tryParseCollectionFromText(raw, baseLoc(raw));
    if (r !== null) {
      return { cells: r.collection.items.map(asStringValue), usedFromRows: 0 };
    }
  }
  if (raw !== undefined && /^\d+$/.test(raw)) {
    const idx = parseInt(raw, 10);
    const row = rows.items[idx];
    if (row !== undefined && row.kind === 'collection') {
      return { cells: row.items.map(asStringValue), usedFromRows: idx + 1 };
    }
  }
  return undefined;
}

function pickDefaultHeader(rows: CollectionNode): HeaderPick {
  if (rows.items.length === 0) return { cells: null, usedFromRows: 0 };
  const first = rows.items[0];
  if (first === undefined || first.kind !== 'collection') {
    return { cells: null, usedFromRows: 0 };
  }
  return { cells: first.items.map(asStringValue), usedFromRows: 1 };
}

function pickBody(
  rows: CollectionNode,
  schema: SchemaInfo | null,
  skip: number,
): DataValue[] {
  if (schema !== null) return rows.items;          // every row is data
  return rows.items.slice(skip);
}

// ---------------------------------------------------------------------------
// HTML emission.
// ---------------------------------------------------------------------------

function renderHtmlTable(
  header: string[] | null,
  bodyRows: DataValue[],
  schema: SchemaInfo | null,
  caption: string | undefined,
): string {
  let out = '<table>';
  if (caption !== undefined) out += `<caption>${escapeHtml(caption)}</caption>`;
  if (header !== null) out += renderHead(header);
  out += '<tbody>';
  for (const row of bodyRows) out += renderBodyRow(row, schema);
  out += '</tbody></table>';
  return out;
}

function renderHead(cells: readonly string[]): string {
  let row = '<tr>';
  for (const c of cells) row += `<th>${escapeHtml(c)}</th>`;
  return `<thead>${row}</tr></thead>`;
}

function renderBodyRow(row: DataValue, schema: SchemaInfo | null): string {
  if (row.kind === 'collection') return renderCellRow(row.items.map(asStringValue));
  if (row.kind === 'record' && schema !== null) {
    return renderCellRow(extractByKeys(row, schema.keys));
  }
  return `<tr><td>${escapeHtml(asStringValue(row))}</td></tr>`;
}

function renderCellRow(cells: readonly string[]): string {
  let row = '<tr>';
  for (const c of cells) row += `<td>${escapeHtml(c)}</td>`;
  return row + '</tr>';
}

function extractByKeys(rec: RecordNode, keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const field = rec.fields.find((f) => f.key === k);
    out.push(field === undefined ? '' : asStringValue(field.value));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function paramOf(params: readonly Param[], name: string): string | undefined {
  for (const p of params) if (p.name === name) return p.value;
  return undefined;
}

function asStringValue(v: DataValue): string {
  if (v.kind === 'stringValue') return v.value;
  if (v.kind === 'numberValue') return String(v.value);
  if (v.kind === 'booleanValue') return String(v.value);
  if (v.kind === 'nullValue') return '';
  return '';
}

function baseLoc(text: string) {
  return { file: '', line: 1, col: 1, offset: 0, length: text.length };
}
