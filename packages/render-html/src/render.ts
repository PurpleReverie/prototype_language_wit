// HTML renderer for ExpandedDocument.
//
// Walks the expanded AST and emits a semantic HTML string. v1 is
// configuration-free: each AST kind maps to one fixed HTML shape (see
// the mapping table in the task brief). Configurable per-node renderers
// land in a future revision.
//
// Comments are omitted by default; setting WIT_DEBUG_COMMENTS=1 keeps
// them as HTML comment markers for debugging. ScriptBlock and ScriptCall
// nodes are always omitted — their effects ran during expansion.
//
// All text content and attribute values pass through `escapeHtml` so
// malformed prose can't produce malformed HTML.

import type {
  Block,
  Inline,
  Paragraph,
  NodeUse,
  Italic,
  Bold,
  Text,
  Comment,
  Interpolation,
  Record as RecordNode,
  Collection,
  DataValue,
  Param,
} from '@wit/parser';
import type { ExpandedDocument } from '@wit/runtime';
import { escapeHtml } from './escape.js';
import { tryRenderCore } from './render-core-vocab.js';
import { tryRenderTable } from './render-table.js';

export function renderHtml(doc: ExpandedDocument): string {
  const inner = renderBlocks(doc.children);
  return `<article class="wit-doc">${inner}</article>`;
}

// ---------------------------------------------------------------------------
// Block-level rendering.
// ---------------------------------------------------------------------------

function renderBlocks(blocks: readonly Block[]): string {
  let out = '';
  for (const block of blocks) out += renderBlock(block);
  return out;
}

function renderBlock(block: Block): string {
  // Records/Collections can land at block position after expansion of a
  // def whose body was a literal data value — render them with their
  // standalone table/list defaults. They are not part of the Block union
  // statically, hence the kind probe via an unknown widening.
  const kind = (block as unknown as { kind: string }).kind;
  if (kind === 'record') return renderRecord(block as unknown as RecordNode);
  if (kind === 'collection') {
    return renderCollection(block as unknown as Collection);
  }
  if (block.kind === 'paragraph') return renderParagraph(block);
  if (block.kind === 'comment') return renderComment(block);
  if (block.kind === 'nodeUse') return renderNodeUse(block);
  if (block.kind === 'ifStatement') return renderBlocks(block.then);
  if (block.kind === 'eachStatement') return renderBlocks(block.body);
  // Definitions, references, script blocks: omitted from HTML output.
  return '';
}

function renderParagraph(p: Paragraph): string {
  return `<p>${renderInlines(p.children)}</p>`;
}

function renderComment(c: Comment): string {
  if (process.env['WIT_DEBUG_COMMENTS'] !== '1') return '';
  // Strip any `--` runs from the comment body to avoid breaking the
  // surrounding HTML comment.
  const safe = c.text.replace(/--+/g, '-');
  return `<!-- ${safe} -->`;
}

// ---------------------------------------------------------------------------
// Inline-level rendering.
// ---------------------------------------------------------------------------

function renderInlines(items: readonly Inline[]): string {
  let out = '';
  for (const item of items) out += renderInline(item);
  return out;
}

function renderInline(item: Inline): string {
  if (item.kind === 'text') return renderText(item);
  if (item.kind === 'italic') return renderItalic(item);
  if (item.kind === 'bold') return renderBold(item);
  if (item.kind === 'nodeUse') return renderNodeUse(item);
  if (item.kind === 'interpolation') return renderInterpolation(item);
  if (item.kind === 'comment') return renderComment(item);
  // bodySlot, scriptBlock, scriptCall: omitted (or unreachable post-expand).
  return '';
}

function renderText(t: Text): string {
  return escapeHtml(t.value);
}

function renderItalic(node: Italic): string {
  return `<em>${renderInlines(node.children)}</em>`;
}

function renderBold(node: Bold): string {
  return `<strong>${renderInlines(node.children)}</strong>`;
}

function renderInterpolation(node: Interpolation): string {
  // Unresolved interpolation surfaces as a fallback span so the gap is
  // visible in the rendered output rather than silently empty.
  return `<span class="wit-unresolved">::${escapeHtml(node.name)}::</span>`;
}

// ---------------------------------------------------------------------------
// NodeUse rendering — covers inline/block, data access, and container
// values (Record / Collection).
// ---------------------------------------------------------------------------

function renderNodeUse(use: NodeUse): string {
  if (use.access !== undefined && use.access.length > 0) {
    return renderUnresolvedAccess(use);
  }
  return renderNodeUseShell(use);
}

function renderUnresolvedAccess(use: NodeUse): string {
  const path = [use.name, ...(use.access ?? [])].join('.');
  return `<span class="wit-unresolved">@${escapeHtml(path)}</span>`;
}

function renderNodeUseShell(use: NodeUse): string {
  // `@table` has its own complex renderer (schema + rows + caption).
  const tableHtml = tryRenderTable(use, renderInlines, renderBlocks);
  if (tableHtml !== null) return tableHtml;
  // `@bibliography` emits each contributed entry as its own paragraph
  // so APA citations don't run together. Predates core-vocab because
  // it has no native HTML element.
  if (use.name === 'bibliography') return renderBibliography(use);
  // Core vocab + @node pass-through dispatch.
  const coreHtml = tryRenderCore(use, renderUseBody);
  if (coreHtml !== null) return coreHtml;
  const body = renderUseBody(use);
  if (isStandaloneRecord(use)) return renderRecord(extractRecord(use)!);
  if (isStandaloneCollection(use)) {
    return renderCollection(extractCollection(use)!);
  }
  const tag = use.inline ? 'span' : 'div';
  return `<${tag}${nodeAttrs(use)}>${body}</${tag}>`;
}

function nodeAttrs(use: NodeUse): string {
  let attrs = ` class="wit-node" data-wit-name="${escapeHtml(use.name)}"`;
  for (const p of use.params) attrs += renderParamAttr(p);
  return attrs;
}

function renderParamAttr(p: Param): string {
  if (p.name === null) return '';
  return ` data-param-${escapeHtml(p.name)}="${escapeHtml(p.value)}"`;
}

function renderBibliography(use: NodeUse): string {
  if (use.body === null) return '<div class="wit-bibliography"></div>';
  const parts: string[] = [];
  for (const child of use.body) {
    const rendered = isBlockChild(child)
      ? renderBlock(child as Block)
      : renderInline(child as Inline);
    if (rendered.length === 0) continue;
    // Strip a single surrounding `<p>…</p>` so the entry is one clean
    // `<p>` even if the inner Paragraph already wraps it.
    const m = /^<p>([\s\S]*)<\/p>$/.exec(rendered.trim());
    const inner = m !== null ? m[1]!.trim() : rendered.trim();
    if (inner.length > 0) parts.push(`<p>${inner}</p>`);
  }
  return `<div class="wit-bibliography">${parts.join('')}</div>`;
}

function renderUseBody(use: NodeUse): string {
  if (use.body === null) return '';
  let out = '';
  for (const child of use.body) {
    if (isBlockChild(child)) out += renderBlock(child as Block);
    else out += renderInline(child as Inline);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Record / Collection rendering for stand-alone uses whose body collapsed
// to a single record or collection literal (parser-defs M3 behavior).
// ---------------------------------------------------------------------------

function isStandaloneRecord(use: NodeUse): boolean {
  return extractRecord(use) !== null;
}

function isStandaloneCollection(use: NodeUse): boolean {
  return extractCollection(use) !== null;
}

function extractRecord(use: NodeUse): RecordNode | null {
  if (use.body === null || use.body.length !== 1) return null;
  const only = use.body[0]! as unknown as { kind: string };
  return only.kind === 'record' ? (only as unknown as RecordNode) : null;
}

function extractCollection(use: NodeUse): Collection | null {
  if (use.body === null || use.body.length !== 1) return null;
  const only = use.body[0]! as unknown as { kind: string };
  return only.kind === 'collection' ? (only as unknown as Collection) : null;
}

function renderRecord(rec: RecordNode): string {
  let rows = '';
  for (const field of rec.fields) {
    rows += `<tr><th>${escapeHtml(field.key)}</th>`;
    rows += `<td>${renderDataValue(field.value)}</td></tr>`;
  }
  return `<table class="wit-record">${rows}</table>`;
}

function renderCollection(col: Collection): string {
  let items = '';
  for (const item of col.items) items += `<li>${renderDataValue(item)}</li>`;
  return `<ul class="wit-collection">${items}</ul>`;
}

function renderDataValue(value: DataValue): string {
  if (value.kind === 'stringValue') return escapeHtml(value.value);
  if (value.kind === 'numberValue') return escapeHtml(String(value.value));
  if (value.kind === 'booleanValue') return escapeHtml(String(value.value));
  if (value.kind === 'nullValue') return '';
  if (value.kind === 'record') return renderRecord(value);
  return renderCollection(value);
}

// ---------------------------------------------------------------------------
// Block/inline discrimination for NodeUse children — mirrors the
// expander's heuristic (kind = nodeUse keeps its inline flag).
// ---------------------------------------------------------------------------

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

function isBlockChild(node: Block | Inline): boolean {
  if (node.kind === 'nodeUse') return !(node as NodeUse).inline;
  return BLOCK_KINDS.has(node.kind);
}
