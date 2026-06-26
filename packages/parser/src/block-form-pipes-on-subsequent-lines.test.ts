// W-4 — block-form invocation accepts pipes on subsequent lines.
//
// Per example 05-parameters.wit ("pipes scatter, last one wins"), the
// natural authoring shape places the pipes on the line(s) after the
// open token. All four shapes parse to the same NodeUse.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { NodeUse } from './ast.js';

function paramsOf(src: string): { name: string; value: string }[] {
  const doc = parse(src, '<test>');
  const u = doc.children[0] as NodeUse;
  return u.params.map((p) => ({ name: p.name ?? '?', value: p.value }));
}

describe('W-4 — block-form pipes on subsequent lines', () => {
  it('inline pipes on open line', () => {
    const params = paramsOf(`@greeting |name Robert|
Body content.
greeting@`);
    expect(params).toEqual([{ name: 'name', value: 'Robert' }]);
  });

  it('pipes on a single subsequent line', () => {
    const params = paramsOf(`@greeting
|name Robert|
Body content.
greeting@`);
    expect(params).toEqual([{ name: 'name', value: 'Robert' }]);
  });

  it('pipes on the same subsequent line', () => {
    const params = paramsOf(`@greeting
|name Robert| |year 2024|
Body content.
greeting@`);
    expect(params).toEqual([
      { name: 'name', value: 'Robert' },
      { name: 'year', value: '2024' },
    ]);
  });

  it('pipes spread across several subsequent lines', () => {
    const params = paramsOf(`@greeting
|name Robert|
|year 2024|
Body content.
greeting@`);
    expect(params).toEqual([
      { name: 'name', value: 'Robert' },
      { name: 'year', value: '2024' },
    ]);
  });
});
