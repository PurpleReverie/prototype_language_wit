// W-5 — a bare-pipes `@cite |a v|` followed by a block-form `@cite ... cite@`
// of the same name no longer mis-consumes the later close.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { NodeUse } from './ast.js';

describe('W-5 — bare pipes then block form, same name', () => {
  it('first invocation self-closes, second is bodied', () => {
    const src = `#cite ||a||
::a::
cite#

@cite |a Smith|

@cite
  a: Came H.
  filler: x
cite@`;
    expect(() => parse(src, '<test>')).not.toThrow();
    const doc = parse(src, '<test>');
    // Find the two @cite uses.
    const uses = doc.children.filter(
      (c) => c.kind === 'nodeUse' && (c as NodeUse).name === 'cite',
    ) as NodeUse[];
    expect(uses).toHaveLength(2);
    expect(uses[0]!.body).toBeNull();
    expect(uses[1]!.body).not.toBeNull();
  });

  // Intervening prose between two `@cite` uses currently still
  // surfaces the legacy ambiguity (the lexer sees a single `name@`
  // close somewhere downstream and can't tell whose body the prose
  // belongs to). The simple case fixed above covers the report's
  // minimal repro.
});
