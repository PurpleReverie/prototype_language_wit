// Unit coverage for the script-runner (runScripts).
//
// Scripts are executed against the lh bridge in document order. Block
// ScriptBlocks are evaluated for side effects and dropped from the
// output; inline ScriptBlocks are evaluated for their return value
// which gets spliced into the prose as a Text node.

import { describe, it, expect } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve } from './resolver.js';
import { expand } from './expander.js';
import { createLhBridge } from './lh-bridge.js';
import { runScripts } from './script-runner.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';

function pipeline(src: string) {
  const doc = parse(src, '<inline>');
  const resolved = resolve(doc);
  const expanded = expand(resolved);
  return { resolved, expanded };
}

describe('runScripts — block scripts', () => {
  it('drops a successfully executed block script from the output', () => {
    const { expanded } = pipeline('<% lh.set("k", 1) %>\n\nhello\n');
    for (const child of expanded.children) {
      expect(child.kind).not.toBe('scriptBlock');
    }
  });

  it('side-effects flow through the lh bridge overlay', () => {
    const doc = parse('<% lh.set("k", 42) %>\n\nhi\n', '<inline>');
    const resolved = resolve(doc);
    const expanded = expand(resolved);
    // After expand (which runs scripts), build a fresh bridge to inspect
    // the overlay populated during expansion is not visible — overlay is
    // owned by the bridge instance used during expand. So run again directly.
    const expanded2 = expand(resolve(parse('hi\n', '<inline>')));
    const bridge = createLhBridge({ expanded: expanded2, resolved });
    runScripts(
      { ...expanded2, children: [...expanded.children, ...wrapScript('lh.set("k", 42)')] },
      bridge,
    );
    expect(bridge.overlay.get('k')).toBe(42);
  });

  it('wraps thrown script errors in ExpanderError with E_SCRIPT_ERROR', () => {
    const src = '<% throw new Error("boom") %>\n\nhi\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    try {
      expand(resolved);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ExpanderError);
      expect((err as ExpanderError).code).toBe(RuntimeErrorCode.E_SCRIPT_ERROR);
    }
  });
});

describe('runScripts — last-script-wins', () => {
  it('later scripts observe earlier scripts mutations', () => {
    const src = '<% lh.set("k", 1) %>\n\n<% lh.set("k", 2) %>\n\nhi\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    // Build expanded manually so we can inspect bridge overlay.
    const expanded = expand(resolve(parse('hi\n', '<inline>')));
    const bridge = createLhBridge({ expanded, resolved });
    runScripts(
      {
        ...expanded,
        children: [
          ...wrapScript('lh.set("k", 1)'),
          ...wrapScript('lh.set("k", 2)'),
        ],
      },
      bridge,
    );
    expect(bridge.overlay.get('k')).toBe(2);
  });
});

describe('runScripts — function decls become available to @scriptCall', () => {
  it('captures function decls into the env for later script calls', () => {
    const src =
      '<%\nfunction greet() { return "hi"; }\n%>\n\n' +
      'before @scriptCall(greet) after\n';
    const { expanded } = pipeline(src);
    const flat = JSON.stringify(expanded.children);
    expect(flat).toContain('hi');
  });
});

// ---------------------------------------------------------------------------
// Helper: synthesize a block-level ScriptBlock for runScripts.
// ---------------------------------------------------------------------------

function wrapScript(content: string) {
  const loc = { file: '<test>', line: 1, col: 1, offset: 0, length: 0 };
  return [
    {
      kind: 'scriptBlock' as const,
      content,
      inline: false,
      loc,
    },
  ];
}
