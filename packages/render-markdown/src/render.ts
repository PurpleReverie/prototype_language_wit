// Markdown renderer for ExpandedDocument.
//
// Walks the expanded AST and emits a CommonMark-compatible Markdown
// string. Mirrors @witlang/render-html but produces plain text with
// Markdown syntax. Conventional NodeUse names (h1..h6, chapter, figure,
// callout, aside, pullquote, bibliography, dl, ul/ol, blockquote, pre,
// hr, table, a, img) each have a hand-rolled mapping. Sectioning names
// (section, subsection, header, footer, article, main, nav) are
// transparent wrappers — they emit their children with proper block
// separation but no leading marker. Unknown NodeUse kinds fall back to
// emitting their content unwrapped.
//
// Block-aware paragraph splitting: when the parser wraps consecutive
// source lines into a single Paragraph that contains block-level uses
// (e.g. an `@h2` plus prose plus a `@ul`), the renderer splits the
// paragraph into separate block chunks joined by `\n\n` so headings,
// lists, and tables each sit on their own line with blank lines around
// them.
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
} from '@witlang/parser';
import type { ExpandedDocument } from '@witlang/runtime';
import {
  renderInlines, renderInline, renderUnresolvedAccess, setBlockDispatcher,
} from './render-inline.js';
import {
  renderNodeUseBlock,
  setBlockRecursor,
  renderChildList,
  isBlockLevelUse,
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
    pushChunks(out, renderBlockMulti(block));
  }
  return out;
}

function pushChunks(out: string[], chunks: readonly string[]): void {
  for (const c of chunks) if (c.length > 0) out.push(c);
}

// Returns one or more block chunks. A paragraph containing block-level
// NodeUses (e.g. @h1, @ul, @table sitting on their own line in source)
// is split into multiple chunks so the renderer can join them with the
// standard `\n\n` block separator.
export function renderBlockMulti(block: Block): string[] {
  const kind = (block as unknown as { kind: string }).kind;
  if (kind === 'record') return [renderRecordBlock(block as unknown as RecordNode)];
  if (kind === 'collection') {
    return [renderCollectionBlock(block as unknown as Collection)];
  }
  if (block.kind === 'paragraph') return paragraphChunks(block.children);
  if (block.kind === 'nodeUse') return [renderNodeUseBlock(block)];
  if (block.kind === 'ifStatement') return collectBlockChunks(block.then);
  if (block.kind === 'eachStatement') return collectBlockChunks(block.body);
  // comment, nodeDef, dataDef, reference, scriptBlock: omitted.
  return [];
}

export function renderBlock(block: Block): string {
  return renderBlockMulti(block).filter((c) => c.length > 0).join('\n\n');
}

// Walks paragraph children, emitting one chunk per run of inline content
// and one chunk per block-level NodeUse. Whitespace-only Text nodes
// adjacent to a block-level NodeUse are dropped. Inline runs are trimmed
// of leading / trailing whitespace; internal whitespace is preserved
// (Markdown is whitespace-tolerant in inline position).
export function paragraphChunks(children: readonly Inline[]): string[] {
  const chunks: string[] = [];
  let inlineRun: Inline[] = [];
  const flush = (): void => {
    if (inlineRun.length === 0) return;
    const rendered = renderInlines(inlineRun);
    const trimmed = rendered.replace(/\s+/g, ' ').trim();
    if (trimmed.length > 0) chunks.push(trimmed);
    inlineRun = [];
  };
  for (const child of children) {
    if (
      child.kind === 'nodeUse'
      && (child.access === undefined || child.access.length === 0)
      && isBlockLevelUse(child)
    ) {
      flush();
      const rendered = renderNodeUseBlock(child);
      if (rendered.length > 0) chunks.push(rendered);
      continue;
    }
    inlineRun.push(child);
  }
  flush();
  return chunks;
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
