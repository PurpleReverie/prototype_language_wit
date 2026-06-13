// Block-level NodeUse rendering for Markdown.
//
// Maps conventional NodeUse names to Markdown structures. Unknown names
// fall back to emitting the body content with no decoration.
//
// `setBlockRecursor` is called by render.ts on entry to break the
// circular dependency: render-block.ts needs to recurse through
// arbitrary blocks (paragraphs, nested uses), but render.ts already
// owns the master dispatch and imports this module.

import type { Block, Inline, NodeUse, Param } from '@witlang/parser';
import { isCoreVocabName, RESERVED_OPAQUE } from '@witlang/runtime';
import { renderInline, renderInlines, renderUnresolvedAccess } from './render-inline.js';
import { renderTableMarkdown } from './render-table.js';

type BlockRecursor = (block: Block) => string;
let recurse: BlockRecursor = () => '';

export function setBlockRecursor(fn: BlockRecursor): void {
  recurse = fn;
}

// Block-level core-vocab names. A NodeUse with one of these names should
// always sit on its own block chunk in Markdown output, even if the
// parser produced it with `inline=true` (which happens when the use
// appears within a paragraph-wrapped run of source lines).
const BLOCK_VOCAB_NAMES = new Set<string>([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'chapter', 'section', 'subsection',
  'p', 'blockquote', 'pre', 'hr',
  'ul', 'ol', 'dl', 'figure', 'table',
  'callout', 'aside', 'pullquote', 'bibliography',
  'article', 'header', 'footer', 'nav', 'main',
]);

export function isBlockLevelUse(use: NodeUse): boolean {
  if (!use.inline) return true;
  return BLOCK_VOCAB_NAMES.has(use.name);
}

export function renderNodeUseBlock(use: NodeUse): string {
  if (use.access !== undefined && use.access.length > 0) {
    return renderUnresolvedAccess(use);
  }
  if (use.name === 'table') return renderTableMarkdown(use, renderInline);
  if (use.name === RESERVED_OPAQUE) return renderOpaqueBlock(use);
  const handler = HANDLERS.get(use.name);
  if (handler !== undefined) return handler(use);
  // Inline-mark names (em/strong/code/...) appearing at block position
  // still render as Markdown inline marks wrapped in their content.
  if (INLINE_MARK_NAMES.has(use.name)) return renderInline(use);
  if (isCoreVocabName(use.name)) return renderCoreVocabBlock(use);
  return renderBodyChunks(use).join('\n\n');
}

const INLINE_MARK_NAMES = new Set<string>([
  'em', 'strong', 'code', 'u', 's', 'sub', 'sup', 'mark', 'small',
  'a', 'img', 'cite', 'br',
]);

function renderOpaqueBlock(use: NodeUse): string {
  // `@node(type X)` — dispatch by type to a core handler if matched,
  // else just emit the body (Markdown has no opaque container).
  const type = paramValue(use.params, 'type');
  if (type !== undefined && isCoreVocabName(type)) {
    const handler = HANDLERS.get(type);
    if (handler !== undefined) return handler(use);
  }
  return renderBodyChunks(use).join('\n\n');
}

function renderCoreVocabBlock(use: NodeUse): string {
  // Core names not covered by a hand-rolled handler — best-effort fallback
  // (e.g. `@section`, `@article`): emit body unwrapped.
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
  // Each `+#bibliography` contribution lands as its own Block child of
  // the `@bibliography` use's body — render each as a stand-alone
  // paragraph and separate them with a blank line so APA entries don't
  // run together. Internal newlines within an entry collapse to a single
  // space (the entries are author-facing one-liners).
  const items: string[] = [];
  for (const child of use.body) {
    const rendered = renderChild(child);
    if (rendered.length === 0) continue;
    items.push(rendered.replace(/\n+/g, ' ').trim());
  }
  return items.join('\n\n');
}

function listHandler(ordered: boolean): (use: NodeUse) => string {
  return (use) => renderList(use, ordered);
}

function renderList(use: NodeUse, ordered: boolean): string {
  if (use.body === null) return '';
  const lines: string[] = [];
  let i = 1;
  for (const child of use.body) {
    if ((child as { kind: string }).kind !== 'nodeUse') continue;
    const liUse = child as NodeUse;
    if (liUse.name !== 'li') continue;
    const inner = renderBodyChunks(liUse).join(' ').trim();
    const prefix = ordered ? `${i}.` : '-';
    lines.push(`${prefix} ${inner}`);
    i += 1;
  }
  return lines.join('\n');
}

function linkHandler(use: NodeUse): string {
  const href = paramValue(use.params, 'href') ?? '';
  const text = renderInlineBody(use);
  return `[${text}](${href})`;
}

function imgHandler(use: NodeUse): string {
  const src = paramValue(use.params, 'src') ?? '';
  const alt = paramValue(use.params, 'alt') ?? '';
  return `![${alt}](${src})`;
}

function preHandler(use: NodeUse): string {
  const inner = renderBodyChunks(use).join('\n');
  return '```\n' + inner + '\n```';
}

function codeInlineHandler(use: NodeUse): string {
  return '`' + renderInlineBody(use) + '`';
}

function hrHandler(_use: NodeUse): string {
  return '---';
}

function brHandler(_use: NodeUse): string {
  return '  ';
}

function dlHandler(use: NodeUse): string {
  if (use.body === null) return '';
  // Walk the body collecting term/definition pairs. `@dt`/`@dd` may
  // arrive either as direct NodeUse children (when authored on separate
  // source lines as block uses) OR wrapped inside Paragraph children
  // (when authored inline on the same source line as `@dl`, or when
  // produced by template expansion). Descend through Paragraph wrappers
  // so both shapes pair up correctly.
  const pairs: { term: string; def: string }[] = [];
  let pendingTerm: string | null = null;
  const visit = (node: Block | Inline): void => {
    const kind = (node as { kind: string }).kind;
    if (kind === 'paragraph') {
      const para = node as { children: Inline[] };
      for (const c of para.children) visit(c);
      return;
    }
    if (kind !== 'nodeUse') return;
    const c = node as NodeUse;
    if (c.name === 'dt') {
      if (pendingTerm !== null) pairs.push({ term: pendingTerm, def: '' });
      pendingTerm = renderInlineBody(c);
      return;
    }
    if (c.name === 'dd') {
      const def = renderInlineBody(c);
      pairs.push({ term: pendingTerm ?? '', def });
      pendingTerm = null;
    }
  };
  for (const child of use.body) visit(child);
  if (pendingTerm !== null) pairs.push({ term: pendingTerm, def: '' });
  const blocks = pairs.map(({ term, def }) => {
    if (term.length === 0) return def;
    if (def.length === 0) return `**${term}**`;
    return `**${term}**: ${def}`;
  });
  return blocks.filter((b) => b.length > 0).join('\n\n');
}

const HANDLERS = new Map<string, (use: NodeUse) => string>([
  ['h1', headingHandler(1)],
  ['h2', headingHandler(2)],
  ['h3', headingHandler(3)],
  ['h4', headingHandler(4)],
  ['h5', headingHandler(5)],
  ['h6', headingHandler(6)],
  ['chapter', headingHandler(1)],
  // section / subsection / header / footer / article / main / nav are
  // sectioning wrappers — they emit their children with block separation
  // but no leading marker. Handled by renderCoreVocabBlock fallback (no
  // entry in HANDLERS).
  ['figure', figureHandler],
  ['callout', blockquoteHandler],
  ['aside', blockquoteHandler],
  ['pullquote', blockquoteHandler],
  ['blockquote', blockquoteHandler],
  ['bibliography', bibliographyHandler],
  ['ul', listHandler(false)],
  ['ol', listHandler(true)],
  ['a', linkHandler],
  ['img', imgHandler],
  ['pre', preHandler],
  ['code', codeInlineHandler],
  ['hr', hrHandler],
  ['br', brHandler],
  ['dl', dlHandler],
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
    const kind = (child as { kind: string }).kind;
    if (kind === 'paragraph') {
      const para = child as { children: Inline[] };
      for (const inl of para.children) parts.push(renderInline(inl));
      continue;
    }
    if (isInlineKind(kind)) {
      parts.push(renderInline(child as Inline));
    }
  }
  // Collapse runs of whitespace (including embedded source-indent
  // newlines) to a single space — inline context is always a single line.
  return parts.join('').replace(/\s+/g, ' ').trim();
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
