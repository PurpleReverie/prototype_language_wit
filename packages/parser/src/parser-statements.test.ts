// Unit tests for paren-statement parsing (M3.conditionals + M3.iteration).

import { describe, expect, it } from 'vitest';

import { parse } from './parser.js';
import type {
  ComparisonCondition,
  EachStatement,
  ExistenceCondition,
  IfStatement,
  Paragraph,
  StringValue,
  Text,
} from './ast.js';

function firstIf(src: string): IfStatement {
  const doc = parse(src);
  const found = doc.children.find((c) => c.kind === 'ifStatement');
  if (!found) throw new Error('no ifStatement in document');
  return found as IfStatement;
}

function firstEach(src: string): EachStatement {
  const doc = parse(src);
  const found = doc.children.find((c) => c.kind === 'eachStatement');
  if (!found) throw new Error('no eachStatement in document');
  return found as EachStatement;
}

describe('parseIfStatement', () => {
  it('parses (if @x.y is value) ... (end) as comparison', () => {
    const node = firstIf('(if @x.y is true) ok (end)');
    expect(node.kind).toBe('ifStatement');
    const cond = node.cond as ComparisonCondition;
    expect(cond.kind).toBe('comparisonCondition');
    expect(cond.op).toBe('is');
    expect(cond.left.segments).toEqual(['x', 'y']);
    expect((cond.right as StringValue).value).toBe('true');
    expect(node.else).toBeUndefined();
  });

  it('accepts equals as a synonym for is', () => {
    const node = firstIf('(if @x.y equals draft) ok (end)');
    const cond = node.cond as ComparisonCondition;
    expect(cond.op).toBe('equals');
    expect((cond.right as StringValue).value).toBe('draft');
  });

  it('parses bare @x.y as ExistenceCondition (truthy)', () => {
    const node = firstIf('(if @x.flag) ok (end)');
    const cond = node.cond as ExistenceCondition;
    expect(cond.kind).toBe('existenceCondition');
    expect(cond.path.segments).toEqual(['x', 'flag']);
  });

  it('parses (if ...) ... (else) ... (end)', () => {
    const node = firstIf('(if @x.flag) A (else) B (end)');
    expect(node.else).toBeDefined();
    const thenPara = node.then[0] as Paragraph;
    if (!node.else) throw new Error('expected else branch');
    const elsePara = node.else[0] as Paragraph;
    expect((thenPara.children[0] as Text).value).toContain('A');
    expect((elsePara.children[0] as Text).value).toContain('B');
  });

  it('handles nested (if ...) inside the then-branch', () => {
    const node = firstIf('(if @a.x) (if @b.y) inner (end) (end)');
    const inner = node.then.find((c) => c.kind === 'ifStatement') as
      IfStatement | undefined;
    expect(inner).toBeDefined();
    if (inner) {
      const cond = inner.cond as ExistenceCondition;
      expect(cond.path.segments).toEqual(['b', 'y']);
    }
  });

  it('emits empty then[] when body is empty', () => {
    const node = firstIf('(if @x.f) (end)');
    // Allow either no paragraphs or a whitespace-only paragraph; both are
    // valid per the empty-then lean (rule a — no diagnostic).
    expect(node.then.length).toBeLessThanOrEqual(1);
  });
});

describe('parseEachStatement', () => {
  it('parses (each @xs as item) body (end)', () => {
    const node = firstEach('(each @xs as item) hi (end)');
    expect(node.kind).toBe('eachStatement');
    expect(node.collection.segments).toEqual(['xs']);
    expect(node.itemName).toBe('item');
    expect(node.body.length).toBeGreaterThanOrEqual(1);
  });

  it('parses dotted access path in collection', () => {
    const node = firstEach('(each @deck.hands as hand) @hand, (end)');
    expect(node.collection.segments).toEqual(['deck', 'hands']);
    expect(node.itemName).toBe('hand');
  });

  it('handles nested each within body', () => {
    const node = firstEach(
      '(each @decks as deck) (each @deck.hands as hand) @hand (end) (end)',
    );
    const inner = node.body.find((c) => c.kind === 'eachStatement') as
      EachStatement | undefined;
    expect(inner).toBeDefined();
    if (inner) {
      expect(inner.collection.segments).toEqual(['deck', 'hands']);
      expect(inner.itemName).toBe('hand');
    }
  });

  it('allows (if ...) inside an (each ...) body', () => {
    const node = firstEach(
      '(each @hands as item) (if @item.awake is true) hi (end) (end)',
    );
    const inner = node.body.find((c) => c.kind === 'ifStatement');
    expect(inner).toBeDefined();
  });

  it('emits empty body[] when iteration body is empty', () => {
    const node = firstEach('(each @xs as item) (end)');
    expect(node.body.length).toBeLessThanOrEqual(1);
  });
});
