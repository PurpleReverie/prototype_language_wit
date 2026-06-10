// Core reserved node-vocabulary (M10.core-vocab Thread 2 + 3).
//
// These names need no `#def` in source — the resolver skips binding
// lookup for them, and renderers ship explicit handlers. `node` is a
// universal opaque pass-through; the rest mirror HTML's semantic shapes.

export const RESERVED_OPAQUE = 'node';

export const CORE_VOCAB_NAMES: readonly string[] = [
  // Headings.
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Inline marks.
  'em', 'strong', 'code', 'u', 's', 'sub', 'sup', 'mark', 'small', 'br',
  // Lists.
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Links + media.
  'a', 'img', 'figure', 'figcaption', 'audio', 'video',
  // Tables.
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  // Blocks.
  'p', 'blockquote', 'pre', 'hr',
  // Sectioning.
  'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
  // Other.
  'cite',
];

const CORE_VOCAB_SET = new Set<string>([...CORE_VOCAB_NAMES, RESERVED_OPAQUE]);

export function isReservedNodeName(name: string): boolean {
  return CORE_VOCAB_SET.has(name);
}

export function isCoreVocabName(name: string): boolean {
  return CORE_VOCAB_SET.has(name) && name !== RESERVED_OPAQUE;
}
