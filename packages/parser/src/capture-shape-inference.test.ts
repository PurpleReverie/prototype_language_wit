// W-16: shape-probed typed param values.
//
// Pipe-form, form-fill, and parens param values get a typed `typedValue`
// when the captured text looks like a collection, record, or scalar
// literal. Pure prose strings stay untyped (only `value` populated).

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { Document, NodeUse, Param } from './ast.js';

function paramsOf(src: string): Param[] {
  const doc = parse(src, '<test>') as Document;
  // Walk to first NodeUse, possibly nested in paragraph.
  for (const c of doc.children) {
    if (c.kind === 'nodeUse') return (c as NodeUse).params;
    if (c.kind === 'paragraph') {
      for (const ch of c.children) {
        if (ch.kind === 'nodeUse') return (ch as NodeUse).params;
      }
    }
  }
  throw new Error('no NodeUse found');
}

describe('W-16 — capture shape inference', () => {
  it('pipe-form: `[ a, b ]` typedValue is a collection', () => {
    const params = paramsOf('@x |authors [ Smith, Brown, Jones ]|');
    expect(params).toHaveLength(1);
    const p = params[0]!;
    expect(p.name).toBe('authors');
    expect(p.typedValue?.kind).toBe('collection');
  });

  it('pipe-form: `{ a - b }` typedValue is a record', () => {
    const params = paramsOf('@x |meta { kind - test, n - 2 }|');
    expect(params).toHaveLength(1);
    expect(params[0]!.typedValue?.kind).toBe('record');
  });

  it('pipe-form: numeric value typed as numberValue', () => {
    const params = paramsOf('@x |year 2024|');
    const t = params[0]!.typedValue;
    expect(t?.kind).toBe('numberValue');
    if (t?.kind === 'numberValue') expect(t.value).toBe(2024);
  });

  it('pipe-form: boolean literal typed as booleanValue', () => {
    const params = paramsOf('@x |flag true|');
    expect(params[0]!.typedValue?.kind).toBe('booleanValue');
  });

  it('pipe-form: null literal typed as nullValue', () => {
    const params = paramsOf('@x |slot null|');
    expect(params[0]!.typedValue?.kind).toBe('nullValue');
  });

  it('pipe-form: pure prose stays untyped', () => {
    const params = paramsOf('@x |name Robert|');
    expect(params[0]!.value).toBe('Robert');
    expect(params[0]!.typedValue).toBeUndefined();
  });

  it('form-fill: collection value typedValue is a collection', () => {
    const src = `@x
  authors: [ Smith, Brown ]
  filler: x
x@`;
    const params = paramsOf(src);
    const authors = params.find((p) => p.name === 'authors');
    expect(authors?.typedValue?.kind).toBe('collection');
  });

  it('form-fill: numeric value typed', () => {
    const src = `@x
  year: 2024
  name: Robert
x@`;
    const params = paramsOf(src);
    const year = params.find((p) => p.name === 'year');
    expect(year?.typedValue?.kind).toBe('numberValue');
  });

  it('parens: bracket-nested commas do not split the slot', () => {
    const params = paramsOf('@x(authors [ Smith, Brown, Jones ])');
    expect(params).toHaveLength(1);
    expect(params[0]!.name).toBe('authors');
    expect(params[0]!.typedValue?.kind).toBe('collection');
  });
});
