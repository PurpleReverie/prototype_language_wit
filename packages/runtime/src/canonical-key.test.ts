import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import { canonicalizeKey, lookupRecordField } from './canonical-key.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';
import type { Record as RecordNode } from '@wit/parser';

function flat(nodes: unknown): string {
  return JSON.stringify(nodes);
}

describe('canonicalizeKey', () => {
  it('lowercases', () => {
    expect(canonicalizeKey('YearsAtPost')).toBe('yearsatpost');
  });

  it('strips spaces, hyphens, underscores', () => {
    expect(canonicalizeKey('years at post')).toBe('yearsatpost');
    expect(canonicalizeKey('years-at-post')).toBe('yearsatpost');
    expect(canonicalizeKey('years_at_post')).toBe('yearsatpost');
  });

  it('strips all non-alphanumerics', () => {
    expect(canonicalizeKey('foo!@#bar')).toBe('foobar');
    expect(canonicalizeKey('Years at Post')).toBe('yearsatpost');
  });

  it('keeps digits', () => {
    expect(canonicalizeKey('field2name')).toBe('field2name');
  });

  it('returns empty for all-punctuation', () => {
    expect(canonicalizeKey('---')).toBe('');
  });
});

describe('lookupRecordField — fuzzy access', () => {
  function makeRecord(keys: string[]): RecordNode {
    const loc = { file: '<t>', line: 1, col: 1, length: 0, offset: 0 };
    return {
      kind: 'record',
      loc,
      fields: keys.map((k) => ({
        key: k,
        value: { kind: 'stringValue', value: `v-${k}`, loc },
      })),
    };
  }

  it('matches snake-case access against space-separated key', () => {
    const rec = makeRecord(['years at post']);
    expect(lookupRecordField(rec, 'years_at_post')?.kind).toBe('stringValue');
  });

  it('matches camelCase access against space-separated key', () => {
    const rec = makeRecord(['years at post']);
    const v = lookupRecordField(rec, 'yearsAtPost');
    expect(v && v.kind === 'stringValue' && v.value).toBe('v-years at post');
  });

  it('returns undefined for missing key', () => {
    const rec = makeRecord(['name']);
    expect(lookupRecordField(rec, 'other')).toBeUndefined();
  });

  it('throws E_AMBIGUOUS_RECORD_KEY when two fields collapse', () => {
    const rec = makeRecord(['years at post', 'YearsAtPost']);
    expect(() => lookupRecordField(rec, 'years_at_post')).toThrowError(
      ResolverError,
    );
    try {
      lookupRecordField(makeRecord(['a b', 'AB']), 'ab');
    } catch (e) {
      expect((e as ResolverError).code).toBe(
        RuntimeErrorCode.E_AMBIGUOUS_RECORD_KEY,
      );
    }
  });
});

describe('expander — fuzzy record field access end-to-end', () => {
  it('resolves @x.years_at_post against `years at post` field', () => {
    const src =
      '#x: { years at post - 12 }\n\n' +
      '(if @x.years_at_post is 12)\nOK\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(flat(expanded.children)).toContain('OK');
  });

  it('resolves @x.yearsAtPost against `years at post` field', () => {
    const src =
      '#x: { years at post - 12 }\n\n' +
      '(if @x.yearsAtPost is 12)\nOK\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(flat(expanded.children)).toContain('OK');
  });

  it('still resolves the canonical key form itself', () => {
    const src =
      '#x: { years_at_post - 12 }\n\n' +
      '(if @x.YearsAtPost is 12)\nOK\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(flat(expanded.children)).toContain('OK');
  });

  it('missing-after-canonicalization falls through to falsy', () => {
    const src =
      '#x: { name - Ada }\n\n' +
      '(if @x.years_at_post)\nSEEN\n(else)\nMISS\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(flat(expanded.children)).toContain('MISS');
  });
});
