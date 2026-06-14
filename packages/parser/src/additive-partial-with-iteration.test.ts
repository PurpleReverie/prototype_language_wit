// W-17 — `(each)` and `(if)` inside an additive partial body parse
// without throwing E_UNCLOSED_DEFINITION.
//
// Pre-fix, the def value-block parser delegated to parseInline which
// treats parenStatementOpen as an inline-stop. The (each)...(end)
// never got consumed, so the loop stalled and the `!!` close failed
// to match.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { NodeDef } from './ast.js';

describe('W-17 — paren-statements in additive partial body', () => {
  it('+#name: (each) ... (end) !! parses', () => {
    const src = `+#bibliography:
(each @authors as a) @a (end)
!!`;
    expect(() => parse(src, '<test>')).not.toThrow();
    const doc = parse(src, '<test>');
    expect(doc.children[0]!.kind).toBe('nodeDef');
    const def = doc.children[0] as NodeDef;
    // Body should contain an eachStatement.
    expect(def.body.some((b) => (b as { kind: string }).kind === 'eachStatement')).toBe(true);
  });

  it('+#name: (if) ... (end) !! parses', () => {
    const src = `+#x:
(if @cond) something (end)
!!`;
    expect(() => parse(src, '<test>')).not.toThrow();
  });

  it('+#name with prose followed by (each) parses', () => {
    const src = `+#refs:
Some prose.
(each @items as i) @i (end)
trailing prose.
!!`;
    expect(() => parse(src, '<test>')).not.toThrow();
  });
});
