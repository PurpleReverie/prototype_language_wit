import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import type {
  Block,
  Inline,
  Loc,
  Paragraph,
  NodeUse,
  Text,
  Italic,
  Bold,
  Comment,
  Interpolation,
  Record as RecordNode,
  Collection,
} from '@witlang/parser';
import type { ExpandedDocument } from '@witlang/runtime';
import { renderHtml } from './render.js';
import { escapeHtml } from './escape.js';

const LOC: Loc = { file: 't', line: 1, col: 1, offset: 0, length: 0 };

function doc(children: Block[]): ExpandedDocument {
  return { kind: 'expanded-document', children, loc: LOC };
}

function para(children: Inline[]): Paragraph {
  return { kind: 'paragraph', children, loc: LOC };
}

function text(value: string): Text {
  return { kind: 'text', value, loc: LOC };
}

// ---------------------------------------------------------------------------
// escapeHtml unit tests.
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
  it('escapes the five core entity chars', () => {
    expect(escapeHtml('<a href="b">&\'</a>')).toBe(
      '&lt;a href=&quot;b&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('leaves safe text untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// renderHtml — per-kind mapping.
// ---------------------------------------------------------------------------

describe('renderHtml — Document/Paragraph/Text', () => {
  it('wraps children in article.wit-doc', () => {
    expect(renderHtml(doc([]))).toBe('<article class="wit-doc"></article>');
  });

  it('renders paragraphs with escaped text', () => {
    const html = renderHtml(doc([para([text('hi <there>')])]));
    expect(html).toBe(
      '<article class="wit-doc"><p>hi &lt;there&gt;</p></article>',
    );
  });
});

describe('renderHtml — emphasis', () => {
  it('renders Italic as <em>', () => {
    const node: Italic = { kind: 'italic', children: [text('x')], loc: LOC };
    expect(renderHtml(doc([para([node])]))).toContain('<em>x</em>');
  });

  it('renders Bold as <strong>', () => {
    const node: Bold = { kind: 'bold', children: [text('y')], loc: LOC };
    expect(renderHtml(doc([para([node])]))).toContain('<strong>y</strong>');
  });
});

describe('renderHtml — NodeUse', () => {
  it('renders block use as <div class="wit-node">', () => {
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'sidebar',
      params: [],
      paramsSource: 'none',
      body: [para([text('content')])],
      inline: false,
      closeStyle: 'named',
      loc: LOC,
    };
    const html = renderHtml(doc([use]));
    expect(html).toContain(
      '<div class="wit-node" data-wit-name="sidebar"><p>content</p></div>',
    );
  });

  it('renders inline use as <span class="wit-node">', () => {
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'foo',
      params: [],
      paramsSource: 'none',
      body: [text('inner')],
      inline: true,
      closeStyle: 'parens',
      loc: LOC,
    };
    const html = renderHtml(doc([para([use])]));
    expect(html).toContain(
      '<span class="wit-node" data-wit-name="foo">inner</span>',
    );
  });

  it('emits data-param-* attributes for named params', () => {
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'chapter',
      params: [
        { name: 'num', value: '1', loc: LOC },
        { name: 'title', value: 'Intro <x>', loc: LOC },
        { name: null, value: 'ignored-positional', loc: LOC },
      ],
      paramsSource: 'pipes',
      body: null,
      inline: false,
      closeStyle: 'bare',
      loc: LOC,
    };
    const html = renderHtml(doc([use]));
    expect(html).toContain('data-param-num="1"');
    expect(html).toContain('data-param-title="Intro &lt;x&gt;"');
    expect(html).not.toContain('ignored-positional');
  });

  it('renders use with access path as wit-unresolved span', () => {
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'x',
      access: ['y', 'z'],
      params: [],
      paramsSource: 'none',
      body: null,
      inline: true,
      closeStyle: 'bare',
      loc: LOC,
    };
    expect(renderHtml(doc([para([use])]))).toContain(
      '<span class="wit-unresolved">@x.y.z</span>',
    );
  });
});

describe('renderHtml — Interpolation', () => {
  it('renders unexpanded interpolation as wit-unresolved span', () => {
    const node: Interpolation = { kind: 'interpolation', name: 'foo', loc: LOC };
    expect(renderHtml(doc([para([node])]))).toContain(
      '<span class="wit-unresolved">::foo::</span>',
    );
  });
});

describe('renderHtml — Comment', () => {
  beforeEach(() => {
    delete process.env['WIT_DEBUG_COMMENTS'];
  });

  it('omits comments by default', () => {
    const c: Comment = { kind: 'comment', text: 'note', inline: false, loc: LOC };
    expect(renderHtml(doc([c]))).toBe('<article class="wit-doc"></article>');
  });

  it('emits comments when WIT_DEBUG_COMMENTS=1', () => {
    process.env['WIT_DEBUG_COMMENTS'] = '1';
    const c: Comment = { kind: 'comment', text: 'note', inline: false, loc: LOC };
    expect(renderHtml(doc([c]))).toContain('<!-- note -->');
  });

  afterEach(() => {
    delete process.env['WIT_DEBUG_COMMENTS'];
  });
});

describe('renderHtml — ScriptBlock omission', () => {
  it('drops ScriptBlock', () => {
    const block: Block = {
      kind: 'scriptBlock',
      content: 'lh.set(1)',
      inline: false,
      loc: LOC,
    };
    expect(renderHtml(doc([block]))).toBe(
      '<article class="wit-doc"></article>',
    );
  });
});

describe('renderHtml — Record / Collection as stand-alone use', () => {
  it('renders a Record-bodied use as <table>', () => {
    const record: RecordNode = {
      kind: 'record',
      fields: [
        { key: 'a', value: { kind: 'stringValue', value: '1', loc: LOC } },
        { key: 'b', value: { kind: 'stringValue', value: '<2>', loc: LOC } },
      ],
      loc: LOC,
    };
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'r',
      params: [],
      paramsSource: 'none',
      body: [record as unknown as Block],
      inline: false,
      closeStyle: 'bare',
      loc: LOC,
    };
    const html = renderHtml(doc([use]));
    expect(html).toContain('<table class="wit-record">');
    expect(html).toContain('<tr><th>a</th><td>1</td></tr>');
    expect(html).toContain('<tr><th>b</th><td>&lt;2&gt;</td></tr>');
  });

  it('renders a Collection-bodied use as <ul>', () => {
    const col: Collection = {
      kind: 'collection',
      items: [
        { kind: 'stringValue', value: 'one', loc: LOC },
        { kind: 'stringValue', value: 'two', loc: LOC },
      ],
      loc: LOC,
    };
    const use: NodeUse = {
      kind: 'nodeUse',
      name: 'c',
      params: [],
      paramsSource: 'none',
      body: [col as unknown as Block],
      inline: false,
      closeStyle: 'bare',
      loc: LOC,
    };
    const html = renderHtml(doc([use]));
    expect(html).toContain('<ul class="wit-collection">');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
  });
});

// ---------------------------------------------------------------------------
// Integration: parse + resolve + expand + render an existing fixture.
// ---------------------------------------------------------------------------

describe('renderHtml — integration', () => {
  it('renders sources.wit (definitions-only) as empty article', () => {
    const src = [
      '#weil:   Simone Weil, Gravity and Grace, 1952, Routledge !!',
      '#berger: John Berger, Ways of Seeing, 1972, Penguin !!',
      '#arendt: Hannah Arendt, The Human Condition, 1958, Chicago !!',
      '',
    ].join('\n');
    const parsed = parse(src, 'sources.wit');
    const resolved = resolve(parsed);
    const expanded = expand(resolved);
    const html = renderHtml(expanded);
    // Definitions never produce HTML themselves — only their use sites do.
    expect(html).toBe('<article class="wit-doc"></article>');
  });

  it('renders a use-of-def integration document', () => {
    const src = ['#greeting: hello !!', '', '@greeting()'].join('\n');
    const parsed = parse(src, 'inline.wit');
    const resolved = resolve(parsed);
    const expanded = expand(resolved);
    const html = renderHtml(expanded);
    expect(html).toContain('hello');
    expect(html.startsWith('<article class="wit-doc">')).toBe(true);
    expect(html.endsWith('</article>')).toBe(true);
  });
});
