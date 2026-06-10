// Hover content builder. Pure function: (state, position) → markdown.
//
// Looks up the position in the index, branches on the entry kind, and
// produces a markdown string. The server wraps the string in an LSP
// `Hover` response.

import type { NodeUse, NodeDef, DataDef, Inline } from '@wit/parser';
import { isCoreVocabName, RESERVED_OPAQUE } from '@wit/runtime';
import type { DocumentState } from './document-cache.js';
import { lookupAt, type PositionEntry } from './position-index.js';

export interface HoverResult {
  contents: string; // markdown
}

export function buildHover(
  state: DocumentState,
  line: number,
  col: number,
): HoverResult | null {
  const entry = lookupAt(state.positionIndex, line, col);
  if (!entry) return null;
  if (entry.kind === 'nodeUse') return hoverNodeUse(entry.node as NodeUse, state);
  if (entry.kind === 'nodeDef') return hoverNodeDef(entry.node as NodeDef);
  if (entry.kind === 'dataDef') return hoverDataDef(entry.node as DataDef);
  if (entry.kind === 'interpolation') return hoverInterpolation(entry);
  if (entry.kind === 'accessSegment') return hoverAccessSegment(entry, state);
  return null;
}

function hoverNodeUse(use: NodeUse, state: DocumentState): HoverResult {
  if (use.name === RESERVED_OPAQUE) return md(opaqueLines());
  if (isCoreVocabName(use.name)) return md(coreVocabLines(use.name));
  const binding = state.resolved?.bindings.get(use);
  if (!binding) return md([`\`@${use.name}\` — *unresolved*`]);
  if (binding.kind === 'nodeDef') return md(formatNodeDefHover(binding, use.name));
  return md(formatDataDefHover(binding));
}

function opaqueLines(): string[] {
  return [`\`@node\` (opaque)`, '', 'Opaque renderer pass-through. Params travel to the renderer intact.'];
}

function coreVocabLines(name: string): string[] {
  return [`\`@${name}\` (core vocabulary)`, '', `Reserved name — renderers commit to handling \`${name}\`.`];
}

function hoverNodeDef(def: NodeDef): HoverResult {
  return md(formatNodeDefHover(def, def.name));
}

function hoverDataDef(def: DataDef): HoverResult {
  return md(formatDataDefHover(def));
}

function hoverInterpolation(entry: PositionEntry): HoverResult {
  const name = (entry.node as { name?: string }).name ?? '?';
  return md([`Capture \`${name}\` — interpolated from enclosing def`]);
}

function hoverAccessSegment(
  entry: PositionEntry,
  state: DocumentState,
): HoverResult {
  const use = entry.node as NodeUse;
  const seg = use.access?.[entry.segmentIndex ?? 0];
  const data = state.resolved?.dataDefs.get(use.name);
  if (!data) return md([`Access \`.${seg}\` — *unresolved*`]);
  return md([`Field \`${seg}\` of DataDef \`#${use.name}\``]);
}

function formatNodeDefHover(def: NodeDef, name: string): string[] {
  const lines: string[] = [`\`@${name}\` — NodeDef`];
  lines.push('');
  if (def.captures.length > 0) {
    lines.push(`Captures: [${def.captures.join(', ')}]`);
    lines.push('');
  }
  const preview = bodyPreview(def);
  if (preview) {
    lines.push('Body:');
    lines.push('```wit');
    lines.push(preview);
    lines.push('```');
  }
  return lines;
}

function formatDataDefHover(def: DataDef): string[] {
  const lines: string[] = [`\`#${def.name}\` — DataDef`];
  lines.push('');
  if (def.value.kind === 'record') {
    const keys = def.value.fields.map((f) => f.key);
    lines.push(`Fields: ${keys.join(', ')}`);
  } else if (def.value.kind === 'collection') {
    lines.push(`Collection (${def.value.items.length} items)`);
  }
  return lines;
}

function bodyPreview(def: NodeDef): string {
  const parts: string[] = [];
  for (const child of def.body.slice(0, 4)) {
    if (child.kind === 'text') parts.push((child as { value: string }).value);
    else if (child.kind === 'interpolation') parts.push(`::${(child as Inline & { name: string }).name}::`);
    else if (child.kind === 'paragraph') {
      const txt = (child.children as Inline[])
        .filter((c) => c.kind === 'text')
        .map((c) => (c as { value: string }).value)
        .join('');
      if (txt) parts.push(txt);
    }
  }
  return parts.join(' ').slice(0, 160);
}

function md(lines: readonly string[]): HoverResult {
  return { contents: lines.join('\n') };
}
