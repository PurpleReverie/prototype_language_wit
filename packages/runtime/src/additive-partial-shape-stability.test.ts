// W-6 — when an additive partial disagrees with the prior declaration's
// shape or captures, the error message now points at the prior
// declaration's source position so the author can compare.

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';

describe('W-6 — additive partial shape mismatch references prior loc', () => {
  it('error message includes the prior declaration file:line', () => {
    const src = `#bib: single line value !!

+#bib:
  multi
  line
!!`;
    try {
      resolve(parse(src, '<test>'));
      throw new Error('expected ResolverError');
    } catch (e) {
      expect(e).toBeInstanceOf(ResolverError);
      const err = e as ResolverError;
      expect(err.code).toBe(RuntimeErrorCode.E_PARTIAL_SHAPE_MISMATCH);
      // The message references the prior declaration's loc.
      expect(err.message).toContain('prior declaration at');
      expect(err.message).toContain('<test>:');
    }
  });
});
