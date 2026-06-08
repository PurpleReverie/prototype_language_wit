// Tests for NodeUse parsing: bare, block-body, inline-body, parens,
// pipes, access path, nested same-name, mismatched and unclosed errors.

import { describe, expect, it } from 'vitest';
import { ErrorCode } from './errors.js';
import { parse, ParseError } from './parser.js';
import type { NodeUse, Paragraph } from './ast.js';

// (paragraph cast helper not yet needed; left for future.)


describe('parseNodeUse — block-form', () => {
  it('parses `@aside body aside@` as a block-level NodeUse', () => {
    const doc = parse('@aside\nbody text\naside@');
    expect(doc.children).toHaveLength(1);
    const node = doc.children[0] as NodeUse;
    expect(node.kind).toBe('nodeUse');
    expect(node.name).toBe('aside');
    expect(node.closeStyle).toBe('named');
    expect(node.inline).toBe(false);
    expect(node.params).toEqual([]);
    expect(node.paramsSource).toBe('none');
    expect(node.body).not.toBeNull();
  });

  it('throws E_UNCLOSED_NODE when body never closes', () => {
    expect(() => parse('@aside\nbody text\n')).toThrowError(ParseError);
    try {
      parse('@aside\nbody text\n');
    } catch (e) {
      expect((e as ParseError).code).toBe(ErrorCode.E_UNCLOSED_NODE);
    }
  });

  it('throws E_MISMATCHED_CLOSE on wrong-name close', () => {
    try {
      parse('@aside\nbody\nother@');
    } catch (e) {
      expect((e as ParseError).code).toBe(ErrorCode.E_MISMATCHED_CLOSE);
    }
  });

  it('handles nested same-name LIFO', () => {
    const src = '@x\nouter\n@x\ninner\nx@\nafter\nx@';
    const doc = parse(src);
    expect(doc.children).toHaveLength(1);
    const outer = doc.children[0] as NodeUse;
    expect(outer.name).toBe('x');
    expect(outer.body).not.toBeNull();
  });
});

describe('parseNodeUse — bare / inline-body', () => {
  it('parses `@weil argued...` as Paragraph with inline bare NodeUse', () => {
    const doc = parse('@weil argued today.');
    expect(doc.children).toHaveLength(1);
    const p = doc.children[0] as Paragraph;
    expect(p.kind).toBe('paragraph');
    const ref = p.children[0] as NodeUse;
    expect(ref.kind).toBe('nodeUse');
    expect(ref.name).toBe('weil');
    expect(ref.closeStyle).toBe('bare');
    expect(ref.body).toBeNull();
    expect(ref.inline).toBe(true);
  });

  it('parses inline `@em x em@` mid-paragraph', () => {
    const doc = parse('hello @em world em@ end.');
    const p = doc.children[0] as Paragraph;
    expect(p.children).toHaveLength(3);
    const middle = p.children[1] as NodeUse;
    expect(middle.kind).toBe('nodeUse');
    expect(middle.name).toBe('em');
    expect(middle.inline).toBe(true);
    expect(middle.closeStyle).toBe('named');
    expect(middle.body).not.toBeNull();
  });

  it('parses access path `@book.title`', () => {
    const doc = parse('the @book.title here.');
    const p = doc.children[0] as Paragraph;
    const ref = p.children[1] as NodeUse;
    expect(ref.kind).toBe('nodeUse');
    expect(ref.name).toBe('book');
    expect(ref.access).toEqual(['title']);
  });
});

describe('parseNodeUse — parens / self-closing', () => {
  it('parses `@x()` empty parens as self-closing', () => {
    const doc = parse('@x()');
    const p = doc.children[0] as Paragraph;
    const node = p.children[0] as NodeUse;
    expect(node.kind).toBe('nodeUse');
    expect(node.paramsSource).toBe('parens');
    expect(node.closeStyle).toBe('parens');
    expect(node.params).toEqual([]);
  });

  it('parses `@badge(a, b, c)` positional params', () => {
    const doc = parse('@badge(a, b, c)');
    const p = doc.children[0] as Paragraph;
    const node = p.children[0] as NodeUse;
    expect(node.params).toHaveLength(3);
    expect(node.params[0].name).toBeNull();
    expect(node.params[0].value).toBe('a');
  });

  it('parses `@badge(tone good)` as named param', () => {
    const doc = parse('@badge(tone good)');
    const p = doc.children[0] as Paragraph;
    const node = p.children[0] as NodeUse;
    expect(node.params[0].name).toBe('tone');
    expect(node.params[0].value).toBe('good');
  });

  it('parses `@panel(background colour - dark slate)` hyphen-multi-word', () => {
    const doc = parse('@panel(background colour - dark slate)');
    const p = doc.children[0] as Paragraph;
    const node = p.children[0] as NodeUse;
    expect(node.params[0].name).toBe('background colour');
    expect(node.params[0].value).toBe('dark slate');
  });

  it('parses `@badge(verified!)` flag', () => {
    const doc = parse('@badge(verified!)');
    const p = doc.children[0] as Paragraph;
    const node = p.children[0] as NodeUse;
    expect(node.params[0].name).toBe('verified');
    expect(node.params[0].value).toBe('');
  });
});

describe('parseNodeUse — pipe-form params', () => {
  it('parses `@x |a y|`', () => {
    const doc = parse('@x |a y| x@');
    const node = doc.children[0] as NodeUse;
    expect(node.paramsSource).toBe('pipes');
    expect(node.params[0].name).toBe('a');
    expect(node.params[0].value).toBe('y');
  });

  it('parses multiple consecutive pipe pairs', () => {
    const doc = parse('@x |a 1| |b 2| x@');
    const node = doc.children[0] as NodeUse;
    expect(node.params).toHaveLength(2);
    expect(node.params[1].name).toBe('b');
  });
});
