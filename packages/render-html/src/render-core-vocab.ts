// HTML rendering for the core reserved vocabulary (M10.core-vocab).
//
// Each core-vocab name maps to one HTML element. Param names mirror
// the element's attribute names (e.g. `@a |href ...|` → `<a href=...>`)
// — only a small allowlist per element makes it through escapeHtml.
//
// `@node(type X)` is special: it's a universal opaque pass-through.
// Render strategy: dispatch on `type` if recognized as core-vocab,
// otherwise emit a tag derived from `type` (or a `<div data-wit-type=...>`).

import type { NodeUse, Param } from '@wit/parser';
import { isCoreVocabName, RESERVED_OPAQUE } from '@wit/runtime';
import { escapeHtml } from './escape.js';

export type BodyRenderer = (use: NodeUse) => string;

export function tryRenderCore(
  use: NodeUse, renderBody: BodyRenderer,
): string | null {
  if (use.name === RESERVED_OPAQUE) return renderOpaque(use, renderBody);
  if (!isCoreVocabName(use.name)) return null;
  return renderCoreElement(use.name, use, renderBody);
}

// ---------------------------------------------------------------------------
// @node dispatch — pick a tag from `type` param.
// ---------------------------------------------------------------------------

function renderOpaque(use: NodeUse, renderBody: BodyRenderer): string {
  const type = paramValue(use.params, 'type');
  if (type !== undefined && isCoreVocabName(type)) {
    return renderCoreElement(type, use, renderBody);
  }
  // Unknown type → emit a generic div carrying every param as data-*.
  const attrs = passThroughAttrs(use.params);
  const body = renderBody(use);
  return `<div${attrs}>${body}</div>`;
}

function passThroughAttrs(params: readonly Param[]): string {
  let out = '';
  for (const p of params) {
    if (p.name === null) continue;
    out += ` data-${attrName(p.name)}="${escapeHtml(p.value)}"`;
  }
  return out;
}

function attrName(name: string): string {
  return escapeHtml(name).replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ---------------------------------------------------------------------------
// Core element dispatch.
// ---------------------------------------------------------------------------

function renderCoreElement(
  tag: string, use: NodeUse, renderBody: BodyRenderer,
): string {
  if (tag === 'a') return renderAnchor(use, renderBody);
  if (tag === 'img') return renderImg(use);
  if (tag === 'audio' || tag === 'video') return renderMedia(tag, use, renderBody);
  if (tag === 'br' || tag === 'hr') return `<${tag}>`;
  if (tag === 'table') {
    // table handled in render-table; this branch is a fallback.
    return renderGeneric(tag, use, renderBody);
  }
  return renderGeneric(tag, use, renderBody);
}

function renderGeneric(
  tag: string, use: NodeUse, renderBody: BodyRenderer,
): string {
  const attrs = coreAttrs(use.params, tag);
  const body = renderBody(use);
  return `<${tag}${attrs}>${flattenIfInline(tag, body)}</${tag}>`;
}

// Inline-context core elements unwrap a single leading `<p>...</p>` so
// `@h1 Title h1@` (whose body is a Paragraph) renders as `<h1>Title</h1>`
// instead of `<h1><p>Title</p></h1>`.
const INLINE_CONTEXT_TAGS = new Set<string>([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'em', 'strong', 'code', 'u', 's', 'sub', 'sup', 'mark', 'small',
  'a', 'figcaption', 'caption', 'th', 'td', 'li', 'dt', 'dd', 'cite',
]);

function flattenIfInline(tag: string, body: string): string {
  if (!INLINE_CONTEXT_TAGS.has(tag)) return body;
  const m = /^<p>([\s\S]*)<\/p>$/.exec(body.trim());
  if (m === null) return body.trim();
  return m[1]!.trim();
}

function renderAnchor(use: NodeUse, renderBody: BodyRenderer): string {
  const href = escapeHtml(paramValue(use.params, 'href') ?? '#');
  const target = paramValue(use.params, 'target');
  const targetAttr = target !== undefined ? ` target="${escapeHtml(target)}"` : '';
  return `<a href="${href}"${targetAttr}>${flattenIfInline('a', renderBody(use))}</a>`;
}

function renderImg(use: NodeUse): string {
  const src = escapeHtml(paramValue(use.params, 'src') ?? '');
  const alt = escapeHtml(paramValue(use.params, 'alt') ?? '');
  let extra = '';
  const w = paramValue(use.params, 'width');
  if (w !== undefined) extra += ` width="${escapeHtml(w)}"`;
  const h = paramValue(use.params, 'height');
  if (h !== undefined) extra += ` height="${escapeHtml(h)}"`;
  return `<img src="${src}" alt="${alt}"${extra}>`;
}

function renderMedia(
  tag: 'audio' | 'video', use: NodeUse, renderBody: BodyRenderer,
): string {
  const src = paramValue(use.params, 'src');
  const srcAttr = src !== undefined ? ` src="${escapeHtml(src)}"` : '';
  const controls = paramFlag(use.params, 'controls');
  const ctlAttr = controls ? ' controls' : '';
  return `<${tag}${srcAttr}${ctlAttr}>${renderBody(use)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Per-tag attribute mapping (the lean: explicit allowlist; ignore extras).
// ---------------------------------------------------------------------------

function coreAttrs(params: readonly Param[], _tag: string): string {
  // Generic core elements get only an optional `id` and `class` attr if
  // explicitly supplied — keeps the renderer's surface area predictable.
  let out = '';
  const id = paramValue(params, 'id');
  if (id !== undefined) out += ` id="${escapeHtml(id)}"`;
  const cls = paramValue(params, 'class');
  if (cls !== undefined) out += ` class="${escapeHtml(cls)}"`;
  return out;
}

export function paramValue(
  params: readonly Param[], name: string,
): string | undefined {
  for (const p of params) if (p.name === name) return p.value;
  return undefined;
}

function paramFlag(params: readonly Param[], name: string): boolean {
  for (const p of params) if (p.name === name) return true;
  return false;
}
