// Tests for document outline.

import { describe, it, expect } from 'vitest';
import { stateFromSource } from './_test-helpers.js';
import { buildDocumentSymbols } from './document-symbols.js';

describe('buildDocumentSymbols', () => {
  it('emits one entry per top-level NodeDef', () => {
    const src = '#a\n  x\na#\n\n#b\n  y\nb#\n';
    const syms = buildDocumentSymbols(stateFromSource(src));
    const names = syms.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('emits a variable entry for each DataDef', () => {
    const src = '#paper: { name - Foo } !!\n#year: 2024 !!\n';
    const syms = buildDocumentSymbols(stateFromSource(src));
    const paper = syms.find((s) => s.name === 'paper');
    expect(paper?.kind).toBe('variable');
  });

  it('returns empty for documents with no defs', () => {
    expect(buildDocumentSymbols(stateFromSource('text only.\n'))).toEqual([]);
  });
});
