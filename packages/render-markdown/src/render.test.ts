import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve, expand } from '@wit/runtime';
import type {
  Block,
  Inline,
  Loc,
  Paragraph,
  NodeUse,
  Text,
  Italic,
  Bold,
  Interpolation,
  Record as RecordNode,
  Collection,
} from '@wit/parser';
import type { ExpandedDocument } from '@wit/runtime';
import { renderMarkdown } from './render.js';

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

function useBlock(name: string, body: (Block | Inline)[] | null): NodeUse {
  return {
    kind: 'nodeUse',
    name,
    params: [],
    paramsSource: 'none',
    body,
    inline: false,
    closeStyle: 'named',
    loc: LOC,
  };
}

describe('renderMarkdown — Document / Paragraph / Text', () => {
  it('renders empty document as empty string', () => {
    expect(renderMarkdown(doc([]))).toBe('');
  });

  it('renders a paragraph as plain text with trailing newline', () => {
    expect(renderMarkdown(doc([para([text('hello world')])]))).toBe(
      'hello world\n',
    );
  });

  it('joins multiple paragraphs with a blank line', () => {
    const out = renderMarkdown(
      doc([para([text('one')]), para([text('two')])]),
    );
    expect(out).toBe('one\n\ntwo\n');
  });
});

describe('renderMarkdown — emphasis', () => {
  it('renders Italic as *content*', () => {
    const node: Italic = { kind: 'italic', children: [text('x')], loc: LOC };
    expect(renderMarkdown(doc([para([node])]))).toBe('*x*\n');
  });

  it('renders Bold as **content**', () => {
    const node: Bold = { kind: 'bold', children: [text('y')], loc: LOC };
    expect(renderMarkdown(doc([para([node])]))).toBe('**y**\n');
  });

  it('mixes emphasis with surrounding text', () => {
    const italic: Italic = { kind: 'italic', children: [text('go')], loc: LOC };
    const out = renderMarkdown(doc([para([text('we '), italic, text(' now')])]));
    expect(out).toBe('we *go* now\n');
  });
});

describe('renderMarkdown — headings', () => {
  it('h1..h6 map to # .. ######', () => {
    for (let level = 1; level <= 6; level++) {
      const u = useBlock(`h${level}`, [text(`title ${level}`)]);
      const out = renderMarkdown(doc([u]));
      expect(out).toBe('#'.repeat(level) + ` title ${level}\n`);
    }
  });

  it('chapter maps to h1', () => {
    const u = useBlock('chapter', [text('intro')]);
    expect(renderMarkdown(doc([u]))).toBe('# intro\n');
  });

  it('section maps to h2 and subsection to h3', () => {
    const sec = useBlock('section', [text('a')]);
    const sub = useBlock('subsection', [text('b')]);
    const out = renderMarkdown(doc([sec, sub]));
    expect(out).toBe('## a\n\n### b\n');
  });

  it('chapter takes title from |title ...| param when present', () => {
    const u: NodeUse = {
      kind: 'nodeUse',
      name: 'chapter',
      params: [
        { name: 'number', value: 'I', loc: LOC },
        { name: 'title', value: 'The Lamp', loc: LOC },
      ],
      paramsSource: 'pipes',
      body: null,
      inline: false,
      closeStyle: 'bare',
      loc: LOC,
    };
    expect(renderMarkdown(doc([u]))).toBe('# The Lamp\n');
  });
});

describe('renderMarkdown — figure', () => {
  it('renders figure as ![caption](src)', () => {
    const u: NodeUse = {
      kind: 'nodeUse',
      name: 'figure',
      params: [
        { name: 'src', value: 'a.png', loc: LOC },
        { name: 'caption', value: 'cap', loc: LOC },
      ],
      paramsSource: 'pipes',
      body: null,
      inline: false,
      closeStyle: 'bare',
      loc: LOC,
    };
    expect(renderMarkdown(doc([u]))).toBe('![cap](a.png)\n');
  });

  it('defaults missing src and caption to empty strings', () => {
    const u = useBlock('figure', null);
    expect(renderMarkdown(doc([u]))).toBe('![]()\n');
  });
});

describe('renderMarkdown — blockquote-style nodes', () => {
  it('callout becomes blockquote', () => {
    const u = useBlock('callout', [para([text('important')])]);
    expect(renderMarkdown(doc([u]))).toBe('> important\n');
  });

  it('aside becomes blockquote', () => {
    const u = useBlock('aside', [para([text('side note')])]);
    expect(renderMarkdown(doc([u]))).toBe('> side note\n');
  });

  it('pullquote becomes blockquote with multi-paragraph prefix', () => {
    const u = useBlock(
      'pullquote',
      [para([text('line one')]), para([text('line two')])],
    );
    expect(renderMarkdown(doc([u]))).toBe('> line one\n>\n> line two\n');
  });
});

describe('renderMarkdown — bibliography', () => {
  it('emits each child body as a "- " list element', () => {
    const item1 = useBlock('cite', [text('Weil 1952')]);
    const item2 = useBlock('cite', [text('Berger 1972')]);
    const bib = useBlock('bibliography', [item1, item2]);
    expect(renderMarkdown(doc([bib]))).toBe('- Weil 1952\n- Berger 1972\n');
  });
});

describe('renderMarkdown — unknown NodeUse', () => {
  it('emits content with no decoration', () => {
    const u = useBlock('mystery', [para([text('plain prose')])]);
    expect(renderMarkdown(doc([u]))).toBe('plain prose\n');
  });

  it('emits unresolved access path as @path', () => {
    const u: NodeUse = {
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
    expect(renderMarkdown(doc([para([u])]))).toBe('@x.y.z\n');
  });
});

describe('renderMarkdown — Interpolation and Comment', () => {
  it('emits unresolved interpolation visibly', () => {
    const node: Interpolation = { kind: 'interpolation', name: 'foo', loc: LOC };
    expect(renderMarkdown(doc([para([node])]))).toBe('::foo::\n');
  });

  it('omits comments', () => {
    const block: Block = {
      kind: 'comment',
      text: 'skip me',
      inline: false,
      loc: LOC,
    };
    expect(renderMarkdown(doc([block]))).toBe('');
  });
});

describe('renderMarkdown — ScriptBlock omission', () => {
  it('drops ScriptBlock', () => {
    const block: Block = {
      kind: 'scriptBlock',
      content: 'lh.set(1)',
      inline: false,
      loc: LOC,
    };
    expect(renderMarkdown(doc([block]))).toBe('');
  });
});

describe('renderMarkdown — Record / Collection as standalone use', () => {
  it('renders a Record-bodied use as a key/value bullet list', () => {
    const record: RecordNode = {
      kind: 'record',
      fields: [
        { key: 'a', value: { kind: 'stringValue', value: '1', loc: LOC } },
        { key: 'b', value: { kind: 'stringValue', value: '2', loc: LOC } },
      ],
      loc: LOC,
    };
    const u = useBlock('paper', [record as unknown as Block]);
    expect(renderMarkdown(doc([u]))).toBe('- **a**: 1\n- **b**: 2\n');
  });

  it('renders a Collection-bodied use as a flat bullet list', () => {
    const col: Collection = {
      kind: 'collection',
      items: [
        { kind: 'stringValue', value: 'x', loc: LOC },
        { kind: 'stringValue', value: 'y', loc: LOC },
      ],
      loc: LOC,
    };
    const u = useBlock('items', [col as unknown as Block]);
    expect(renderMarkdown(doc([u]))).toBe('- x\n- y\n');
  });
});

describe('renderMarkdown — integration', () => {
  it('renders sources.wit (definitions-only) as empty string', () => {
    const src = [
      '#weil:   Simone Weil 1952 !!',
      '#berger: John Berger 1972 !!',
      '',
    ].join('\n');
    const parsed = parse(src, 'sources.wit');
    const resolved = resolve(parsed);
    const expanded = expand(resolved);
    expect(renderMarkdown(expanded)).toBe('');
  });

  it('renders a use-of-def integration document', () => {
    const src = ['#greeting: hello !!', '', '@greeting()'].join('\n');
    const parsed = parse(src, 'greet.wit');
    const resolved = resolve(parsed);
    const expanded = expand(resolved);
    expect(renderMarkdown(expanded)).toBe('hello\n');
  });
});
