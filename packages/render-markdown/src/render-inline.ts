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
  if (use.body === null) return '';
  return renderInlineChildren(use.body);
}

function renderInlineChildren(body: readonly (object & { kind: string })[]): string {
  let out = '';
  for (const child of body) {
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
