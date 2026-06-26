// W-8 — missing required capture throws E_UNRESOLVED_REFERENCE.
//
// Pre-fix, `@greeting` with a `||name||` def and no `|name X|` use-site
// param silently substituted empty for `::name::`, producing
// `"Hello, ."` in the output. Now: missing-key throws explicitly.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';

function expandSrc(src: string): unknown {
  return expand(resolve(parse(src, '<test>')));
}

describe('W-8 — missing required capture errors', () => {
  it('bare reference to a captured def throws', () => {
    const src = `#greeting ||name||
Hello, ::name::.
greeting#

A bare reference inline: @greeting.`;
    try {
      expandSrc(src);
      throw new Error('expected ExpanderError');
    } catch (e) {
      expect(e).toBeInstanceOf(ExpanderError);
      expect((e as ExpanderError).code).toBe(
        RuntimeErrorCode.E_UNRESOLVED_REFERENCE,
      );
    }
  });

  it('use with one capture but def has two throws on the missing one', () => {
    const src = `#cite ||a, b||
::a:: / ::b::.
cite#

@cite |a Smith|`;
    try {
      expandSrc(src);
      throw new Error('expected ExpanderError');
    } catch (e) {
      expect(e).toBeInstanceOf(ExpanderError);
    }
  });

  it('a flag param with empty string value still satisfies the capture', () => {
    // Flag params (`@x |flag!|`) bind name -> "". This should NOT throw —
    // the env has the key, just with an empty value.
    const src = `#x ||flag||
Flag is "::flag::".
x#

@x |flag!|`;
    expect(() => expandSrc(src)).not.toThrow();
  });
});
