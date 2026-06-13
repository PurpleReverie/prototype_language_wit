// Unit tests for the AST-to-semantic-token walker.
// Tests the pure function — no LSP runtime.

import { describe, it, expect } from 'vitest';
import { parse } from '@witlang/parser';
import {
  collectSemanticTokens,
  encodeTokens,
  SEMANTIC_TOKEN_TYPES,
} from './semantic-tokens.js';

function tokenize(src: string): ReturnType<typeof collectSemanticTokens> {
  return collectSemanticTokens(parse(src));
}

function indexOf(name: typeof SEMANTIC_TOKEN_TYPES[number]): number {
  return SEMANTIC_TOKEN_TYPES.indexOf(name);
}

describe('collectSemanticTokens', () => {
  it('emits a comment token for line comments', () => {
    const tokens = tokenize('~ a remark\n');
    expect(tokens.some((t) => t.tokenType === 'comment')).toBe(true);
  });

  it('emits a function-or-macro token for #name definitions', () => {
    const tokens = tokenize('#year: 1923\n');
    const fnTokens = tokens.filter((t) => t.tokenType === 'function');
    expect(fnTokens.length).toBeGreaterThan(0);
  });

  it('uses macro for capturing definitions', () => {
    const tokens = tokenize('#chapter ||num|| ::num:: chapter#\n');
    const macros = tokens.filter((t) => t.tokenType === 'macro');
    expect(macros.length).toBeGreaterThan(0);
  });

  it('emits tag for node uses', () => {
    const tokens = tokenize('@year.value\n');
    const tags = tokens.filter((t) => t.tokenType === 'tag');
    expect(tags.length).toBeGreaterThan(0);
  });

  it('emits property tokens for access-path segments', () => {
    const tokens = tokenize('@book.title\n');
    const props = tokens.filter((t) => t.tokenType === 'property');
    expect(props.length).toBeGreaterThan(0);
  });

  it('emits variable for interpolations', () => {
    const tokens = tokenize('#chapter ||x|| ::x:: chapter#\n');
    const vars = tokens.filter((t) => t.tokenType === 'variable');
    expect(vars.length).toBeGreaterThan(0);
  });

  it('returns tokens sorted by (line, startChar)', () => {
    const tokens = tokenize('~ one\n~ two\n~ three\n');
    for (let i = 1; i < tokens.length; i += 1) {
      const prev = tokens[i - 1]!;
      const curr = tokens[i]!;
      const cmp = prev.line === curr.line
        ? prev.startChar - curr.startChar
        : prev.line - curr.line;
      expect(cmp).toBeLessThanOrEqual(0);
    }
  });
});

describe('encodeTokens', () => {
  it('produces a flat 5-tuple-per-token wire format', () => {
    const tokens = tokenize('~ first\n#year: 1923\n');
    const data = encodeTokens(tokens);
    expect(data.length % 5).toBe(0);
    expect(data.length).toBeGreaterThan(0);
  });

  it('encodes deltaLine + deltaStart relative to previous token', () => {
    const tokens = [
      { line: 0, startChar: 0, length: 5, tokenType: 'comment' as const, modifiers: 0 },
      { line: 0, startChar: 10, length: 4, tokenType: 'tag' as const, modifiers: 0 },
      { line: 2, startChar: 3, length: 2, tokenType: 'keyword' as const, modifiers: 0 },
    ];
    const data = encodeTokens(tokens);
    expect(data.slice(0, 5)).toEqual([0, 0, 5, indexOf('comment'), 0]);
    expect(data.slice(5, 10)).toEqual([0, 10, 4, indexOf('tag'), 0]);
    expect(data.slice(10, 15)).toEqual([2, 3, 2, indexOf('keyword'), 0]);
  });

  it('handles empty input', () => {
    expect(encodeTokens([])).toEqual([]);
  });
});

describe('SEMANTIC_TOKEN_TYPES legend', () => {
  it('matches the brief: 9 types in the specified order', () => {
    expect(SEMANTIC_TOKEN_TYPES).toEqual([
      'comment', 'string', 'keyword', 'function', 'tag',
      'parameter', 'macro', 'variable', 'property',
    ]);
  });
});
