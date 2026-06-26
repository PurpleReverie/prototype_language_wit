// W-15 — bare `@name` at end of a def body parses as a reference, not
// an unclosed block-form open.
//
// Pre-fix, the shape detector saw the def's `name#` close token after
// the bare ref and decided `bodied`, then parseBodied looked for
// `bibliography@` and errored as unclosed. Treat hash-close / bangBang
// / next-def-open as implicit paragraph boundaries for shape detection.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { NodeDef } from './ast.js';

describe('W-15 — bare ref before def close', () => {
  it('`@bibliography` followed by `name#` parses as bare ref', () => {
    const src = `#references
@h1 References h1@

@bibliography
references#`;
    expect(() => parse(src, '<test>')).not.toThrow();
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('nodeDef');
    const def = doc.children[0] as NodeDef;
    // Body should contain a bare nodeUse for `@bibliography`.
    function find(items: readonly unknown[]): boolean {
      for (const it of items) {
        const o = it as { kind: string; name?: string; children?: unknown[] };
        if (o.kind === 'nodeUse' && o.name === 'bibliography') return true;
        if (o.children && find(o.children)) return true;
      }
      return false;
    }
    expect(find(def.body)).toBe(true);
  });

  it('`@ref` followed by `!!` parses as bare ref', () => {
    const src = `#x:
@ref
!!`;
    expect(() => parse(src, '<test>')).not.toThrow();
  });
});
