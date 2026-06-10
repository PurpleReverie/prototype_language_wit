// Inline-level Markdown rendering.

import type {
  Inline,
  Italic,
  Bold,
  Text,
  Interpolation,
  NodeUse,
} from '@wit/parser';

export function renderInlines(items: readonly Inline[]): string {
  let out = '';
  for (const item of items) out += renderInline(item);
  return out;
}

export function renderInline(item: Inline): string {
  if (item.kind === 'text') return renderText(item);
  if (item.kind === 'italic') return renderItalic(item);
  if (item.kind === 'bold') return renderBold(item);
  if (item.kind === 'interpolation') return renderInterpolation(item);
  if (item.kind === 'nodeUse') return renderInlineNodeUse(item);
  // comment, bodySlot, scriptBlock, scriptCall: omitted (or post-expand).
  return '';
}

export function renderText(t: Text): string {
  return t.value;
}

export function renderItalic(node: Italic): string {
  return `*${renderInlines(node.children)}*`;
}

export function renderBold(node: Bold): string {
  return `**${renderInlines(node.children)}**`;
}

export function renderInterpolation(node: Interpolation): string {
  // Unresolved interpolations surface visibly so the gap is not silent.
  return `::${node.name}::`;
}

export function renderUnresolvedAccess(use: NodeUse): string {
  const path = [use.name, ...(use.access ?? [])].join('.');
  return `@${path}`;
}

function renderInlineNodeUse(use: NodeUse): string {
  if (use.access !== undefined && use.access.length > 0) {
    return renderUnresolvedAccess(use);
  }
  const wrapped = renderInlineCoreVocab(use);
  if (wrapped !== null) return wrapped;
  // A block-level NodeUse (table, blockquote, etc.) that landed in
  // inline position via paragraph-wrapping at parse time: defer to the
  // block dispatcher so it gets its semantic rendering.
  if (!use.inline && blockDispatcher !== null) return blockDispatcher(use);
  if (use.body === null) return '';
  return renderInlineChildren(use.body);
}

type BlockUseDispatcher = (use: NodeUse) => string;
let blockDispatcher: BlockUseDispatcher | null = null;

export function setBlockDispatcher(fn: BlockUseDispatcher): void {
  blockDispatcher = fn;
}

function renderInlineCoreVocab(use: NodeUse): string | null {
  const raw = use.body === null ? '' : renderInlineChildren(use.body);
  const body = raw.trim();
  if (use.name === 'em') return `*${body}*`;
  if (use.name === 'strong') return `**${body}**`;
  if (use.name === 'code') return `\`${body}\``;
  if (use.name === 'u') return `<u>${body}</u>`;
  if (use.name === 's') return `~~${body}~~`;
  if (use.name === 'sub') return `<sub>${body}</sub>`;
  if (use.name === 'sup') return `<sup>${body}</sup>`;
  if (use.name === 'mark') return `==${body}==`;
  if (use.name === 'small') return body;
  if (use.name === 'br') return '  \n';
  if (use.name === 'a') return inlineLink(use, body);
  if (use.name === 'img') return inlineImg(use);
  if (use.name === 'cite') return body;
  return null;
}

function inlineLink(use: NodeUse, body: string): string {
  const href = readParam(use, 'href') ?? '';
  return `[${body}](${href})`;
}

function inlineImg(use: NodeUse): string {
  const src = readParam(use, 'src') ?? '';
  const alt = readParam(use, 'alt') ?? '';
  return `![${alt}](${src})`;
}

function readParam(use: NodeUse, name: string): string | undefined {
  for (const p of use.params) if (p.name === name) return p.value;
  return undefined;
}

function renderInlineChildren(body: readonly (object & { kind: string })[]): string {
  let out = '';
  for (const child of body) {
    if (child.kind === 'paragraph') {
      const para = child as unknown as { children: Inline[] };
      for (const inl of para.children) out += renderInline(inl);
      continue;
    }
    if (isInlineKind(child.kind)) out += renderInline(child as unknown as Inline);
  }
  return out;
}

const INLINE_KINDS = new Set<string>([
  'text',
  'italic',
  'bold',
  'interpolation',
  'nodeUse',
  'comment',
  'scriptBlock',
  'scriptCall',
  'bodySlot',
]);

function isInlineKind(kind: string): boolean {
  return INLINE_KINDS.has(kind);
}
