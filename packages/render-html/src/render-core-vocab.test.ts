// HTML core-vocab + @node + @table tests (M10.core-vocab).

import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import { resolve, expand } from '@wit/runtime';
import { renderHtml } from './render.js';

function render(src: string): string {
  return renderHtml(expand(resolve(parse(src))));
}

describe('renderHtml — core vocab', () => {
  it('emits `<h1>` for `@h1`', () => {
    expect(render('@h1 Title h1@')).toContain('<h1>Title</h1>');
  });

  it('emits `<em>` and `<strong>` for inline marks', () => {
    const out = render('@em x em@ @strong y strong@');
    expect(out).toContain('<em>x</em>');
    expect(out).toContain('<strong>y</strong>');
  });

  it('emits `<a href=...>` from |href| param', () => {
    const out = render('@a |href https://example.org| ex a@');
    expect(out).toContain('<a href="https://example.org">');
    expect(out).toContain('ex');
  });

  it('emits self-closing img with src + alt', () => {
    const out = render('@img |src ./x.png| |alt A picture|');
    expect(out).toContain('<img src="./x.png" alt="A picture">');
  });

  it('emits `<ul><li>` for lists', () => {
    const out = render('@ul\n@li A li@\n@li B li@\nul@');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>A</li>');
    expect(out).toContain('<li>B</li>');
  });

  it('emits `<hr>` self-closing', () => {
    expect(render('@hr hr@')).toContain('<hr>');
  });
});

describe('renderHtml — @node opaque container', () => {
  it('dispatches `@node(type X)` to core handler when X is core vocab', () => {
    const out = render('@node |type img| |src ./n.png| |alt N|');
    expect(out).toContain('<img src="./n.png" alt="N">');
  });

  it('emits generic div for unknown type', () => {
    const out = render('@node |type custom-widget| |id q1|');
    expect(out).toContain('<div');
    expect(out).toContain('data-id="q1"');
  });
});

describe('renderHtml — @table', () => {
  it('renders inline CSV rows with header', () => {
    const src = '@table |rows [[A, B], [1, 2], [3, 4]]|';
    const out = render(src);
    expect(out).toContain('<table>');
    expect(out).toContain('<thead>');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td>1</td>');
  });

  it('renders |header false| with no thead', () => {
    const out = render('@table |rows [[a, b], [c, d]]| |header false|');
    expect(out).not.toContain('<thead>');
    expect(out).toContain('<td>a</td>');
  });

  it('renders caption from |caption|', () => {
    const out = render(
      '@table |rows [[A, B], [1, 2]]| |caption Practicum Hours|',
    );
    expect(out).toContain('<caption>Practicum Hours</caption>');
  });

  it('emits empty `<table></table>` when no rows param', () => {
    expect(render('@table table@')).toContain('<table></table>');
  });
});
