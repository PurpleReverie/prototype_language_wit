// Block-level NodeUse rendering for Markdown.
//
// Maps conventional NodeUse names to Markdown structures. Unknown names
// fall back to emitting the body content with no decoration.
//
// `setBlockRecursor` is called by render.ts on entry to break the
// circular dependency: render-block.ts needs to recurse through
// arbitrary blocks (paragraphs, nested uses), but render.ts already
// owns the master dispatch and imports this module.

import type { Block, Inline, NodeUse, Param } from '@wit/parser';
import { renderInline, renderInlines, renderUnresolvedAccess } from './render-inline.js';

type BlockRecursor = (block: Block) => string;
let recurse: BlockRecursor = () => '';

export function setBlockRecursor(fn: BlockRecursor): void {
  recurse = fn;
}

export function renderNodeUseBlock(use: NodeUse): string {
  if (use.access !== undefined && use.access.length > 0) {
    return renderUnresolvedAccess(use);
  }
  const handler = HANDLERS.get(use.name);
  if (handler !== undefined) return handler(use);
  return renderBodyChunks(use).join('\n\n');
}

export function renderChildList(items: readonly (Block | Inline)[]): string {
  const parts: string[] = [];
  for (const child of items) {
    const rendered = renderChild(child);
    if (rendered.length > 0) parts.push(rendered);
  }
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// Conventional handlers.
// ---------------------------------------------------------------------------

function headingHandler(level: number): (use: NodeUse) => string {
  const hashes = '#'.repeat(level);
  return (use) => `${hashes} ${renderInlineBody(use)}`;
}

function figureHandler(use: NodeUse): string {
  const src = paramValue(use.params, 'src') ?? '';
  const caption = paramValue(use.params, 'caption') ?? renderInlineBody(use);
  return `![${caption}](${src})`;
}

function blockquoteHandler(use: NodeUse): string {
  const inner = renderBodyChunks(use).join('\n\n');
  return inner
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n');
}

function bibliographyHandler(use: NodeUse): string {
  if (use.body === null) return '';
  const items: string[] = [];
  for (const child of use.body) {
    const rendered = renderChild(child);
    if (rendered.length === 0) continue;
    const flat = rendered.replace(/\n+/g, ' ').trim();
    items.push(`- ${flat}`);
  }
  return items.join('\n');
}

const HANDLERS = new Map<string, (use: NodeUse) => string>([
  ['h1', headingHandler(1)],
  ['h2', headingHandler(2)],
  ['h3', headingHandler(3)],
  ['h4', headingHandler(4)],
  ['h5', headingHandler(5)],
  ['h6', headingHandler(6)],
  ['chapter', headingHandler(1)],
  ['section', headingHandler(2)],
  ['subsection', headingHandler(3)],
  ['figure', figureHandler],
  ['callout', blockquoteHandler],
  ['aside', blockquoteHandler],
  ['pullquote', blockquoteHandler],
  ['bibliography', bibliographyHandler],
]);

// ---------------------------------------------------------------------------
// Body rendering helpers.
// ---------------------------------------------------------------------------

function renderInlineBody(use: NodeUse): string {
  const title = paramValue(use.params, 'title');
  if (title !== undefined) return title;
  if (use.body === null) return '';
  const parts: string[] = [];
  for (const child of use.body) {
    if (isInlineKind((child as { kind: string }).kind)) {
      parts.push(renderInline(child as Inline));
    }
  }
  return parts.join('').trim();
}

function renderBodyChunks(use: NodeUse): string[] {
  if (use.body === null) return [];
  const out: string[] = [];
  for (const child of use.body) {
    const rendered = renderChild(child);
    if (rendered.length > 0) out.push(rendered);
  }
  return out;
}

function renderChild(child: Block | Inline): string {
  const kind = (child as { kind: string }).kind;
  if (kind === 'nodeUse') {
    const u = child as NodeUse;
    return u.inline ? renderInline(u) : renderNodeUseBlock(u);
  }
  if (isInlineKind(kind)) return renderInlines([child as Inline]);
  return recurse(child as Block);
}

function paramValue(params: readonly Param[], name: string): string | undefined {
  for (const p of params) {
    if (p.name === name) return p.value;
  }
  return undefined;
}

const INLINE_KINDS = new Set<string>([
  'text',
  'italic',
  'bold',
  'interpolation',
  'comment',
  'scriptBlock',
  'scriptCall',
  'bodySlot',
]);

function isInlineKind(kind: string): boolean {
  return INLINE_KINDS.has(kind);
}
