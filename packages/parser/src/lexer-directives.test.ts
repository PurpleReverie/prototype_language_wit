// Unit tests for the `reference ./path.wit` directive recognizer
// (M3.references).

import { describe, expect, it } from 'vitest';

import { lex } from './lexer.js';
import type { ReferenceDirectiveToken } from './tokens.js';

function references(src: string): ReferenceDirectiveToken[] {
  return lex(src).filter((t): t is ReferenceDirectiveToken =>
    t.kind === 'referenceDirective',
  );
}

describe('tryReferenceDirective', () => {
  it('lexes a single line-start reference', () => {
    const toks = references('reference ./one.wit\n');
    expect(toks).toHaveLength(1);
    expect(toks[0].path).toBe('./one.wit');
  });

  it('lexes back-to-back references on consecutive lines', () => {
    const toks = references('reference ./a.wit\nreference ./b.wit\n');
    expect(toks.map((t) => t.path)).toEqual(['./a.wit', './b.wit']);
  });

  it('captures parent-relative paths verbatim', () => {
    const toks = references('reference ../parent.wit\n');
    expect(toks[0].path).toBe('../parent.wit');
  });

  it('captures subdir paths verbatim', () => {
    const toks = references('reference ./sub/x.wit\n');
    expect(toks[0].path).toBe('./sub/x.wit');
  });

  it('strips trailing horizontal whitespace from the path', () => {
    const toks = references('reference ./a.wit   \n');
    expect(toks[0].path).toBe('./a.wit');
  });

  it('does NOT fire mid-prose', () => {
    const toks = references('See reference ./a.wit in line.\n');
    expect(toks).toHaveLength(0);
  });

  it('does NOT fire when only `reference` (no path) is present', () => {
    const toks = references('reference\n');
    expect(toks).toHaveLength(0);
  });

  it('does NOT fire when path is empty after the space', () => {
    const toks = references('reference \n');
    expect(toks).toHaveLength(0);
  });

  it('fires after a paragraph break', () => {
    const toks = references('Prose.\n\nreference ./a.wit\n');
    expect(toks).toHaveLength(1);
    expect(toks[0].path).toBe('./a.wit');
  });

  it('captures absolute path verbatim (resolver handles)', () => {
    const toks = references('reference /abs/foo.wit\n');
    expect(toks[0].path).toBe('/abs/foo.wit');
  });
});
