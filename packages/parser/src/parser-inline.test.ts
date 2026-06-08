// Focused unit tests for parser-inline.ts. Covers:
// - emphasis pairing (italic, bold, nested, mismatched)
// - line comments inline
// - block comments inline (content carried verbatim)
// - non-emphasis bytes (`snake_case`, `5*6*7`) staying literal

import { describe, expect, it } from 'vitest';

import { parse } from './parser.js';
import type {
  Bold,
  Comment,
  Italic,
  Paragraph,
  Text,
} from './ast.js';

function paragraph(source: string): Paragraph {
  const doc = parse(source);
  expect(doc.children).toHaveLength(1);
  const first = doc.children[0];
  expect(first.kind).toBe('paragraph');
  return first as Paragraph;
}

describe('parser-inline: emphasis', () => {
  it('parses _word_ as Italic[Text]', () => {
    const para = paragraph('hello _world_.');
    expect(para.children).toHaveLength(3);
    expect((para.children[0] as Text).value).toBe('hello ');
    const italic = para.children[1] as Italic;
    expect(italic.kind).toBe('italic');
    expect(italic.children).toHaveLength(1);
    expect((italic.children[0] as Text).value).toBe('world');
    expect((para.children[2] as Text).value).toBe('.');
  });

  it('parses *word* as Bold[Text]', () => {
    const para = paragraph('*bold*');
    expect(para.children).toHaveLength(1);
    const bold = para.children[0] as Bold;
    expect(bold.kind).toBe('bold');
    expect((bold.children[0] as Text).value).toBe('bold');
  });

  it('parses mixed *bold* and _italic_ in one paragraph', () => {
    const para = paragraph('*bold* and _italic_.');
    const kinds = para.children.map((c) => c.kind);
    expect(kinds).toEqual(['bold', 'text', 'italic', 'text']);
  });

  it('parses balanced nested emphasis when the lexer surfaces two open/close pairs', () => {
    // The current lexer's word-boundary rule prevents `_*nested*_` from
    // producing two emphasis-open tokens (the inner `*` is preceded by
    // `_`, which is excluded from boundary status). The parser-level
    // pairing algorithm is nevertheless nesting-capable — exercise it
    // with a sequence the lexer DOES produce: `_a *b* c_` yields four
    // emphasis tokens around alphanumeric runs.
    const para = paragraph('_a *b* c_');
    expect(para.children).toHaveLength(1);
    const italic = para.children[0] as Italic;
    expect(italic.kind).toBe('italic');
    // italic children: [Text("a "), Bold[Text("b")], Text(" c")]
    expect(italic.children).toHaveLength(3);
    expect((italic.children[0] as Text).value).toBe('a ');
    const bold = italic.children[1] as Bold;
    expect(bold.kind).toBe('bold');
    expect((bold.children[0] as Text).value).toBe('b');
    expect((italic.children[2] as Text).value).toBe(' c');
  });

  it('falls back to literal `_` when emphasis open has no matching close', () => {
    // `_unclosed` — emphasisOpen with no close before EOF.
    const para = paragraph('_unclosed');
    expect(para.children).toHaveLength(2);
    expect((para.children[0] as Text).value).toBe('_');
    expect((para.children[1] as Text).value).toBe('unclosed');
  });

  it('treats `snake_case` as a single Text (no emphasis)', () => {
    const para = paragraph('snake_case');
    expect(para.children).toHaveLength(1);
    expect((para.children[0] as Text).value).toBe('snake_case');
  });

  it('treats `5*6*7` as a single Text (no emphasis)', () => {
    const para = paragraph('5*6*7');
    expect(para.children).toHaveLength(1);
    expect((para.children[0] as Text).value).toBe('5*6*7');
  });
});

describe('parser-inline: comments', () => {
  it('embeds a block comment between two Text runs', () => {
    const para = paragraph('hello ~~ inline ~~/ world.');
    expect(para.children).toHaveLength(3);
    expect((para.children[0] as Text).value).toBe('hello ');
    const cmt = para.children[1] as Comment;
    expect(cmt.kind).toBe('comment');
    expect(cmt.inline).toBe(true);
    expect(cmt.text).toBe(' inline ');
    expect((para.children[2] as Text).value).toBe(' world.');
  });

  it('emits a top-level Comment block for a standalone line comment', () => {
    const doc = parse('~ a line comment');
    expect(doc.children).toHaveLength(1);
    const cmt = doc.children[0] as Comment;
    expect(cmt.kind).toBe('comment');
    expect(cmt.inline).toBe(false);
    expect(cmt.text).toBe('a line comment');
  });

  it('emits a top-level Comment block for a standalone block comment', () => {
    const doc = parse('~~ standalone ~~/');
    expect(doc.children).toHaveLength(1);
    const cmt = doc.children[0] as Comment;
    expect(cmt.kind).toBe('comment');
    expect(cmt.inline).toBe(false);
    expect(cmt.text).toBe(' standalone ');
  });

  it('keeps a paragraph + standalone block-comment between paragraphs', () => {
    const doc = parse('first\n\n~~ note ~~/\n\nsecond');
    expect(doc.children).toHaveLength(3);
    expect(doc.children[0].kind).toBe('paragraph');
    expect(doc.children[1].kind).toBe('comment');
    expect((doc.children[1] as Comment).inline).toBe(false);
    expect(doc.children[2].kind).toBe('paragraph');
  });
});
