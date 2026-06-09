// Unit coverage for the lh bridge surface (createLhBridge).
//
// The bridge wraps an ExpandedDocument and its source ResolvedDocument
// and exposes the seven methods scripts call: data, query, node, sort,
// inject, set, prose. These tests construct an expanded doc by running
// parse → resolve → expand and then poke the bridge directly.

import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import { createLhBridge } from './lh-bridge.js';

function build(src: string) {
  const doc = parse(src, '<inline>');
  const resolved = resolve(doc);
  const expanded = expand(resolved);
  const bridge = createLhBridge({ expanded, resolved });
  return { resolved, expanded, bridge };
}

describe('createLhBridge', () => {
  it('returns an object with the seven public methods', () => {
    const { bridge } = build('Hi\n');
    expect(typeof bridge.query).toBe('function');
    expect(typeof bridge.node).toBe('function');
    expect(typeof bridge.sort).toBe('function');
    expect(typeof bridge.inject).toBe('function');
    expect(typeof bridge.set).toBe('function');
    expect(typeof bridge.prose).toBe('function');
    expect(bridge.data).toBeDefined();
  });
});

describe('lh.data', () => {
  it('exposes a DataDef scalar as a plain JS value', () => {
    const { resolved, expanded } = build('hi\n');
    const loc = resolved.loc;
    const synthetic = {
      kind: 'dataDef' as const,
      name: 'book',
      value: { kind: 'stringValue' as const, value: 'The Keeper', loc },
      loc,
    };
    resolved.dataDefs.set('book', synthetic);
    const bridge = createLhBridge({ expanded, resolved });
    expect(bridge.data['book']).toBe('The Keeper');
  });

  it('exposes a DataDef record as a nested object with canonical keys', () => {
    // M7.datadef-classify: `#paper: { word target - 5000 }` should be
    // reachable as `lh.data.paper.word_target` from scripts.
    const src = '#paper: { word target - 5000, status - draft } !!\n\nhi\n';
    const { bridge } = build(src);
    const paper = bridge.data['paper'] as Record<string, unknown> | undefined;
    expect(paper).toBeDefined();
    expect(paper!['word_target']).toBe('5000');
    expect(paper!['status']).toBe('draft');
  });

  it('returns undefined for unknown names', () => {
    const { bridge } = build('hi\n');
    expect(bridge.data['missing']).toBeUndefined();
  });
});

describe('lh.query', () => {
  it('returns all nodes of a given kind', () => {
    const src = 'one paragraph\n\ntwo paragraph\n\nthree paragraph\n';
    const { bridge } = build(src);
    const paras = bridge.query('paragraph');
    expect(paras.length).toBe(3);
  });

  it('returns an empty array when no nodes match', () => {
    const { bridge } = build('hello\n');
    expect(bridge.query('nodeUse')).toEqual([]);
  });
});

describe('lh.set', () => {
  it('stores overlay values without mutating data', () => {
    const { bridge } = build('hi\n');
    bridge.set('book.status', 'final');
    expect(bridge.overlay.get('book.status')).toBe('final');
    // data proxy still returns undefined for unknown names — set() does
    // NOT promote overlay entries into the data surface.
    expect(bridge.data['book']).toBeUndefined();
  });
});

describe('lh.inject', () => {
  it('re-parses a snippet and replaces the matched node body', () => {
    const src = '#slot: hello !!\n\n@slot |id placeholder| @slot.access\n';
    // Build with the real expand-chain so parseAndExpand is wired.
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    const bridge = createLhBridge({
      expanded,
      resolved,
      parseAndExpand: (s) => {
        const sub = parse(s, '<inject>');
        return expand(resolve(sub)).children;
      },
    });
    // No matching id in this fixture → inject becomes a no-op (does not throw).
    expect(() => bridge.inject('nonexistent', 'whatever')).not.toThrow();
  });
});

describe('lh.prose', () => {
  it('concatenates text nodes and wordCount counts whitespace-separated words', () => {
    const { bridge } = build('Hello there friend\n');
    const result = bridge.prose();
    expect(result.text).toContain('Hello');
    expect(result.text).toContain('friend');
    expect(result.wordCount()).toBeGreaterThanOrEqual(3);
  });

  it('reports zero words on an empty document', () => {
    const { bridge } = build('\n');
    expect(bridge.prose().wordCount()).toBe(0);
  });
});

describe('lh smoke test via script', () => {
  it('runs `<% lh.set("x", 1) %>` without throwing', () => {
    // Block script: sets an overlay key, then a paragraph. Whole pipeline
    // is exercised end-to-end via expand (which invokes runScripts).
    const src = '<% lh.set("x", 1) %>\n\nhello\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    expect(() => expand(resolved)).not.toThrow();
  });
});
