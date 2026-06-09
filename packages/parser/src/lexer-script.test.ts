// Tests for lexer-script: `<% %>` recognition.

import { describe, expect, it } from 'vitest';
import { lex, LexerError } from './lexer.js';

describe('lexer-script', () => {
  it('emits ScriptOpen + ScriptBlockContent + ScriptClose around <%...%>', () => {
    const toks = lex('<% x %>');
    const kinds = toks.map((t) => t.kind);
    expect(kinds).toEqual([
      'scriptOpen',
      'scriptBlockContent',
      'scriptClose',
      'eof',
    ]);
    const content = toks[1];
    if (content.kind !== 'scriptBlockContent') throw new Error('unreachable');
    expect(content.text).toBe(' x ');
  });

  it('treats inner Wit markers as opaque bytes', () => {
    const toks = lex('<% @x #y !! %>');
    const content = toks.find((t) => t.kind === 'scriptBlockContent');
    if (!content || content.kind !== 'scriptBlockContent') {
      throw new Error('expected scriptBlockContent');
    }
    expect(content.text).toBe(' @x #y !! ');
  });

  it('emits no scriptBlockContent for empty <%%>', () => {
    const toks = lex('<%%>');
    const kinds = toks.map((t) => t.kind);
    expect(kinds).toEqual(['scriptOpen', 'scriptClose', 'eof']);
  });

  it('raises E_UNCLOSED_SCRIPT when <% has no matching %>', () => {
    expect(() => lex('<% never closed')).toThrow(LexerError);
    try {
      lex('<% never closed');
    } catch (err) {
      if (!(err instanceof LexerError)) throw err;
      expect(err.code).toBe('E_UNCLOSED_SCRIPT');
    }
  });

  it('preserves multiline content verbatim', () => {
    const src = '<%\nconst a = 1;\nconst b = 2;\n%>';
    const toks = lex(src);
    const content = toks.find((t) => t.kind === 'scriptBlockContent');
    if (!content || content.kind !== 'scriptBlockContent') {
      throw new Error('expected scriptBlockContent');
    }
    expect(content.text).toBe('\nconst a = 1;\nconst b = 2;\n');
  });
});
