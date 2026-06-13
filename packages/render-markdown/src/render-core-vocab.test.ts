// Markdown core-vocab + @node + @table tests (M10.core-vocab).

import { describe, it, expect } from 'vitest';
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import { renderMarkdown } from './render.js';

function render(src: string): string {
  return renderMarkdown(expand(resolve(parse(src))));
}

describe('renderMarkdown — core vocab', () => {
  it('emits `# ` heading for `@h1`', () => {
    expect(render('@h1 Title h1@')).toContain('# Title');
  });

  it('emits `*x*` for `@em` and `**y**` for `@strong`', () => {
    const out = render('@em x em@ @strong y strong@');
    expect(out).toContain('*x*');
    expect(out).toContain('**y**');
  });

  it('emits link form for `@a`', () => {
    const out = render('@a |href https://example.org| ex a@');
    expect(out).toContain('[ex](https://example.org)');
  });

  it('emits image form for `@img`', () => {
    const out = render('@img |src ./x.png| |alt A picture|');
    expect(out).toContain('![A picture](./x.png)');
  });

  it('emits `-` list for `@ul` / `@li`', () => {
    const out = render('@ul\n@li A li@\n@li B li@\nul@');
    expect(out).toContain('- A');
    expect(out).toContain('- B');
  });

  it('emits `---` for `@hr`', () => {
    expect(render('@hr hr@')).toContain('---');
  });
});

describe('renderMarkdown — @node passthrough', () => {
  it('dispatches `@node(type h2)` to h2 handler', () => {
    const out = render('@node |type h2| Caption node@');
    expect(out).toContain('## Caption');
  });

  it('emits body when type is unknown (no opaque container in MD)', () => {
    const out = render('@node |type custom| just body content node@');
    expect(out).toContain('just body content');
  });
});

describe('renderMarkdown — @table', () => {
  it('renders inline CSV rows with pipe-table', () => {
    const out = render('@table |rows [[A, B], [1, 2], [3, 4]]|');
    expect(out).toContain('| A | B |');
    expect(out).toContain('| --- | --- |');
    expect(out).toContain('| 1 | 2 |');
  });

  it('renders caption as bold heading line', () => {
    const out = render('@table |rows [[A, B], [1, 2]]| |caption Hours|');
    expect(out).toContain('**Hours**');
  });

  it('omits header when |header false|', () => {
    const out = render('@table |rows [[a, b], [c, d]]| |header false|');
    expect(out).not.toContain('---');
    expect(out).toContain('| a | b |');
  });
});
