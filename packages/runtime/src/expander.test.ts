import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import type { Paragraph, Text } from '@wit/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';

describe('expander — pass-through invariants', () => {
  it('produces an expanded-document shape from a resolved doc', () => {
    const doc = parse('Hello Wit\n', '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(expanded.kind).toBe('expanded-document');
    expect(expanded.loc).toEqual(resolved.loc);
  });

  it('drops NodeDef / DataDef from the output', () => {
    const src = '#g: hello !!\n\nplain prose\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    for (const child of expanded.children) {
      expect(child.kind).not.toBe('nodeDef');
      expect(child.kind).not.toBe('dataDef');
      expect(child.kind).not.toBe('reference');
    }
  });
});

function collectText(nodes: unknown): string {
  return JSON.stringify(nodes);
}

describe('expander — inline NodeDef expansion', () => {
  it('expands `@x()` against `#x: hello !!` to "hello"', () => {
    const src = '#x: hello !!\n\n@x()\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(expanded.children).toHaveLength(1);
    const flat = collectText(expanded.children);
    expect(flat).toContain('hello');
  });

  it('binds capture params and substitutes interpolation', () => {
    const src =
      '#chapter ||num, title||\n' +
      '::num::: ::title::\n' +
      'chapter#\n\n' +
      '@chapter |num 1| |title Intro| chapter@\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('1');
    expect(flat).toContain('Intro');
  });

  it('replaces BodySlot with use-site body content', () => {
    const src =
      '#wrapper\n' +
      '...\n' +
      'wrapper#\n\n' +
      '@wrapper payload wrapper@\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('payload');
  });

  it('expands transitively across nested def references', () => {
    const src =
      '#inner: world !!\n' +
      '#outer\n' +
      'hello @inner()\n' +
      'outer#\n\n' +
      '@outer()\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('hello');
    expect(flat).toContain('world');
  });
});

describe('expander — DataDef resolution', () => {
  it('renders `@p.name()` from a record DataDef as text', () => {
    const src = '#p: { name - Ada, city - London }\n\n@p.name()\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('Ada');
  });
});

describe('expander — loop guard', () => {
  it('throws E_EXPANSION_DEPTH_LIMIT for self-referential def', () => {
    const src = '#loop\n@loop()\nloop#\n\n@loop()\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    expect(() => expand(resolved)).toThrowError(ExpanderError);
    try {
      expand(resolved);
    } catch (e) {
      expect((e as ExpanderError).code).toBe(
        RuntimeErrorCode.E_EXPANSION_DEPTH_LIMIT,
      );
    }
  });
});

describe('expander — IfStatement evaluation', () => {
  it('emits then branch when comparison condition holds', () => {
    const src =
      '#x: { status - draft }\n\n' +
      '(if @x.status is draft)\nHELLO\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('HELLO');
    for (const child of expanded.children) {
      expect(child.kind).not.toBe('ifStatement');
    }
  });

  it('drops then branch when comparison fails (no else)', () => {
    const src =
      '#x: { status - final }\n\n' +
      '(if @x.status is draft)\nHELLO\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).not.toContain('HELLO');
  });

  it('emits else branch when condition fails', () => {
    const src =
      '#x: { status - final }\n\n' +
      '(if @x.status is draft)\nYES\n(else)\nNO\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('NO');
    expect(flat).not.toContain('YES');
  });

  it('treats `is` and `equals` as synonyms', () => {
    const src =
      '#x: { status - draft }\n\n' +
      '(if @x.status equals draft)\nOK\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(collectText(expanded.children)).toContain('OK');
  });

  it('existence condition is truthy for non-empty value', () => {
    const src =
      '#x: { status - draft }\n\n' +
      '(if @x.status)\nSEEN\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(collectText(expanded.children)).toContain('SEEN');
  });

  it('existence condition is falsy for missing field', () => {
    const src =
      '#x: { status - draft }\n\n' +
      '(if @x.nonexistent)\nSEEN\n(else)\nMISS\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const flat = collectText(expanded.children);
    expect(flat).toContain('MISS');
    expect(flat).not.toContain('SEEN');
  });

  it('nested ifs: inner evaluates within outer then branch', () => {
    const src =
      '#x: { a - yes, b - go }\n\n' +
      '(if @x.a is yes)\n(if @x.b is go)\nNESTED\n(end)\n(end)\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    expect(collectText(expanded.children)).toContain('NESTED');
  });
});

describe('expander — paragraph child preservation', () => {
  it('leaves a no-binding-needed paragraph intact', () => {
    const doc = parse('a paragraph here\n', '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const para = expanded.children[0] as Paragraph;
    expect(para.kind).toBe('paragraph');
    const text = para.children.find((c): c is Text => c.kind === 'text');
    expect(text?.value).toContain('a paragraph here');
  });
});
