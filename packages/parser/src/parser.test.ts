// Unit tests for the parser skeleton. Covers:
// - empty source → Document with no children
// - "hello" → one Paragraph with one Text inline
// - "p1\n\np2" → two Paragraphs
// - lexer errors propagate as ParseError carrying the original loc / code

import { describe, expect, it } from 'vitest';

import { parse, ParseError } from './parser.js';
import type { Paragraph, Text } from './ast.js';

describe('parse (skeleton)', () => {
  it('returns an empty Document for empty source', () => {
    const doc = parse('');
    expect(doc.kind).toBe('document');
    expect(doc.children).toEqual([]);
    expect(doc.loc.offset).toBe(0);
    expect(doc.loc.length).toBe(0);
  });

  it('wraps a single prose run into one Paragraph with one Text', () => {
    const doc = parse('hello');
    expect(doc.children).toHaveLength(1);
    const para = doc.children[0] as Paragraph;
    expect(para.kind).toBe('paragraph');
    expect(para.children).toHaveLength(1);
    const text = para.children[0] as Text;
    expect(text.kind).toBe('text');
    expect(text.value).toBe('hello');
  });

  it('splits prose on a paragraph break into two Paragraphs', () => {
    const doc = parse('p1\n\np2');
    expect(doc.children).toHaveLength(2);
    const first = doc.children[0] as Paragraph;
    const second = doc.children[1] as Paragraph;
    expect(first.kind).toBe('paragraph');
    expect(second.kind).toBe('paragraph');
    expect((first.children[0] as Text).value).toBe('p1');
    expect((second.children[0] as Text).value).toBe('p2');
  });

  it('treats multiple blank lines as a single paragraph boundary', () => {
    const doc = parse('a\n\n\n\nb');
    expect(doc.children).toHaveLength(2);
  });

  it('propagates lexer errors as ParseError with original loc', () => {
    // Unclosed block comment triggers E_UNCLOSED_COMMENT in the lexer.
    let caught: unknown = null;
    try {
      parse('~~ never closes');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ParseError);
    const pe = caught as ParseError;
    expect(pe.code).toBe('E_UNCLOSED_COMMENT');
    expect(pe.loc).toBeDefined();
    expect(typeof pe.loc.offset).toBe('number');
  });

  it('uses the provided file name in document loc', () => {
    const doc = parse('hello', 'sample.wit');
    expect(doc.loc.file).toBe('sample.wit');
  });

  it('defaults file name to <inline>', () => {
    const doc = parse('hello');
    expect(doc.loc.file).toBe('<inline>');
  });

  it('parses emphasis tokens into Italic/Bold inline children', () => {
    const doc = parse('hello _world_.');
    const para = doc.children[0] as Paragraph;
    const kinds = para.children.map((c) => c.kind);
    expect(kinds).toEqual(['text', 'italic', 'text']);
  });

  it('promotes a standalone line comment to a top-level Comment block', () => {
    const doc = parse('~ note');
    expect(doc.children).toHaveLength(1);
    expect(doc.children[0].kind).toBe('comment');
  });
});
