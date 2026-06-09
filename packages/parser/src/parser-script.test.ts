// Tests for parser-script: ScriptBlock + ScriptCall parsing.

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import { ParseError } from './parser-errors.js';

describe('parseScriptBlock', () => {
  it('parses a block-level <% %> as a block ScriptBlock', () => {
    const doc = parse('<%\nconst x = 1;\n%>\n');
    expect(doc.children).toHaveLength(1);
    const block = doc.children[0];
    expect(block.kind).toBe('scriptBlock');
    if (block.kind !== 'scriptBlock') throw new Error('unreachable');
    expect(block.inline).toBe(false);
    expect(block.content).toBe('\nconst x = 1;\n');
  });

  it('treats inline <% %> mid-paragraph as inline ScriptBlock', () => {
    const doc = parse('count is <% x %> total\n');
    const para = doc.children[0];
    if (para.kind !== 'paragraph') throw new Error('expected paragraph');
    const inline = para.children[1];
    expect(inline.kind).toBe('scriptBlock');
    if (inline.kind !== 'scriptBlock') throw new Error('unreachable');
    expect(inline.inline).toBe(true);
    expect(inline.content).toBe(' x ');
  });

  it('emits empty content when <%%> has no body', () => {
    const doc = parse('<%%>\n');
    const block = doc.children[0];
    expect(block.kind).toBe('scriptBlock');
    if (block.kind !== 'scriptBlock') throw new Error('unreachable');
    expect(block.content).toBe('');
  });

  it('raises E_UNCLOSED_SCRIPT when no %> appears before EOF', () => {
    expect(() => parse('<% never ends')).toThrow(ParseError);
    try {
      parse('<% never ends');
    } catch (err) {
      if (!(err instanceof ParseError)) throw err;
      expect(err.code).toBe('E_UNCLOSED_SCRIPT');
    }
  });
});

describe('parseScriptCall', () => {
  it('parses @scriptCall(fnName) as a ScriptCall node', () => {
    const doc = parse('prefix @scriptCall(greet) suffix\n');
    const para = doc.children[0];
    if (para.kind !== 'paragraph') throw new Error('expected paragraph');
    const call = para.children[1];
    expect(call.kind).toBe('scriptCall');
    if (call.kind !== 'scriptCall') throw new Error('unreachable');
    expect(call.fnName).toBe('greet');
    expect(call.args).toEqual([]);
  });

  it('captures comma-separated args after the function name', () => {
    const doc = parse('say @scriptCall(greet, "world", 42)\n');
    const para = doc.children[0];
    if (para.kind !== 'paragraph') throw new Error('expected paragraph');
    const call = para.children[1];
    if (call.kind !== 'scriptCall') throw new Error('expected scriptCall');
    expect(call.fnName).toBe('greet');
    expect(call.args).toEqual(['"world"', '42']);
  });

  it('falls through to NodeUse for bare @scriptCall (no parens)', () => {
    const doc = parse('see @scriptCall later\n');
    const para = doc.children[0];
    if (para.kind !== 'paragraph') throw new Error('expected paragraph');
    const node = para.children[1];
    expect(node.kind).toBe('nodeUse');
  });
});
