// Markdown renderer for ExpandedDocument.
//
// Walks the expanded AST and emits a CommonMark-compatible Markdown
// string. Mirrors @wit/render-html but produces plain text with
// Markdown syntax. The conventional NodeUse names (h1..h6, chapter,
// section, subsection, figure, callout, aside, pullquote, bibliography)
// each have a hand-rolled mapping; unknown NodeUse kinds fall back to
// emitting their content without decoration (Markdown has no opaque
// container).
//
// Comments and ScriptBlock nodes are omitted — there is no portable
// Markdown analog without dropping into raw HTML.

import type {
  Block,
  Inline,
  Paragraph,
  NodeUse,
  Record as RecordNode,
  Collection,
  DataValue,
} from '@wit/parser';
import type { ExpandedDocument } from '@wit/runtime';
import {
  renderInlines, renderInline, renderUnresolvedAccess, setBlockDispatcher,
} from './render-inline.js';
import {
  renderNodeUseBlock,
  setBlockRecursor,
  renderChildList,
} from './render-block.js';

export function renderMarkdown(doc: ExpandedDocument): string {
  setBlockRecursor(renderBlock);
  setBlockDispatcher(renderNodeUseBlock);
  const parts = collectBlockChunks(doc.children);
  return joinBlocks(parts);
}

export function joinBlocks(parts: readonly string[]): string {
  const filtered = parts.filter((p) => p.length > 0);
  if (filtered.length === 0) return '';
  return filtered.join('\n\n') + '\n';
}

export function collectBlockChunks(blocks: readonly Block[]): string[] {
  const out: string[] = [];
  for (const block of blocks) {
    const chunk = renderBlock(block);
    if (chunk.length > 0) out.push(chunk);
  }
  return out;
}

export function renderBlock(block: Block): string {
  const kind = (block as unknown as { kind: string }).kind;
  if (kind === 'record') return renderRecordBlock(block as unknown as RecordNode);
  if (kind === 'collection') {
    return renderCollectionBlock(block as unknown as Collection);
  }
  if (block.kind === 'paragraph') return renderParagraph(block);
  if (block.kind === 'nodeUse') return renderNodeUseBlock(block);
  if (block.kind === 'ifStatement') {
    return collectBlockChunks(block.then).join('\n\n');
  }
  if (block.kind === 'eachStatement') {
    return collectBlockChunks(block.body).join('\n\n');
  }
  // comment, nodeDef, dataDef, reference, scriptBlock: omitted.
  return '';
}

function renderParagraph(p: Paragraph): string {
  return renderInlines(p.children);
}

// ---------------------------------------------------------------------------
// Record / Collection blocks. A def whose body collapses to a literal
// record or collection (parser-defs M7 behavior) lands at block position.
// ---------------------------------------------------------------------------

function renderRecordBlock(rec: RecordNode): string {
  const lines: string[] = [];
  for (const f of rec.fields) {
    lines.push(`- **${f.key}**: ${renderDataValueInline(f.value)}`);
  }
  return lines.join('\n');
}

function renderCollectionBlock(col: Collection): string {
  const lines: string[] = [];
  for (const item of col.items) lines.push(`- ${renderDataValueInline(item)}`);
  return lines.join('\n');
}

function renderDataValueInline(value: DataValue): string {
  if (value.kind === 'stringValue') return value.value;
  if (value.kind === 'numberValue') return String(value.value);
  if (value.kind === 'booleanValue') return String(value.value);
  if (value.kind === 'nullValue') return '';
  if (value.kind === 'record') return renderRecordInline(value);
  return renderCollectionInline(value);
}

function renderRecordInline(rec: RecordNode): string {
  const parts = rec.fields.map(
    (f) => `${f.key}: ${renderDataValueInline(f.value)}`,
  );
  return `{ ${parts.join(', ')} }`;
}

function renderCollectionInline(col: Collection): string {
  return `[${col.items.map(renderDataValueInline).join(', ')}]`;
}

// Re-export so consumers can pull straight from the entry point if needed.
export { renderInlines, renderInline, renderUnresolvedAccess, renderChildList };
export type { Block, Inline, Paragraph, NodeUse };
