// W-10 — `resolve` accepts an onMissingReference callback to softly
// skip missing referenced files (instead of throwing
// E_MISSING_REFERENCE_FILE).

import { describe, expect, it } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';

describe('W-10 — optional reference via callback', () => {
  it('default: missing reference throws', () => {
    const src = `reference ./does-not-exist.wit`;
    const doc = parse(src, '<test>');
    expect(() => resolve(doc, { rootPath: '/tmp/x.wit' })).toThrow(ResolverError);
  });

  it('with onMissingReference callback: skip and continue', () => {
    const src = `reference ./does-not-exist.wit`;
    const doc = parse(src, '<test>');
    const seen: string[] = [];
    const r = resolve(doc, {
      rootPath: '/tmp/x.wit',
      onMissingReference: (path) => { seen.push(path); return null; },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('does-not-exist.wit');
    // Resolver still returns a valid document.
    expect(r.kind).toBe('resolved-document');
  });

  it('callback is not invoked for present files', () => {
    const src = `#x: hello !!`;
    const doc = parse(src, '<test>');
    const seen: string[] = [];
    resolve(doc, {
      onMissingReference: (path) => { seen.push(path); return null; },
    });
    expect(seen).toHaveLength(0);
  });

  it('error code stays E_MISSING_REFERENCE_FILE when callback unset', () => {
    const src = `reference ./missing.wit`;
    const doc = parse(src, '<test>');
    try {
      resolve(doc, { rootPath: '/tmp/x.wit' });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ResolverError);
      expect((e as ResolverError).code).toBe(
        RuntimeErrorCode.E_MISSING_REFERENCE_FILE,
      );
    }
  });
});
