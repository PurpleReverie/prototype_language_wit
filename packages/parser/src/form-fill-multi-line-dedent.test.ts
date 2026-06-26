// W-22 — multi-line form-fill values are dedented.
//
// A `body:` key followed by deeper-indented continuation lines used to
// carry the extra leading whitespace into the captured string. Post-fix,
// the common leading indent is stripped so substituted text renders flush.

import { describe, expect, it } from 'vitest';
import { parse } from './index.js';
import type { NodeUse } from './ast.js';

describe('W-22 — multi-line form-fill value dedent', () => {
  it('strips the common leading indent', () => {
    const src = `@post
  title: T
  body:
    First line.
    Second line.
post@`;
    const doc = parse(src, '<test>');
    const use = doc.children[0] as NodeUse;
    const body = use.params.find((p) => p.name === 'body');
    expect(body?.value).toBe('First line.\nSecond line.');
  });

  it('preserves blank-line paragraph breaks inside the value', () => {
    const src = `@post
  title: T
  body:
    First.

    Second.
post@`;
    const doc = parse(src, '<test>');
    const use = doc.children[0] as NodeUse;
    const body = use.params.find((p) => p.name === 'body');
    expect(body?.value).toBe('First.\n\nSecond.');
  });
});
