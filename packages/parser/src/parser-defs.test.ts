// Tests for NodeDef parsing: block, single-line, value-block, captures,
// interpolation, body slot, additive prefix.

import { describe, expect, it } from 'vitest';
import { parse } from './parser.js';
import type {
  DataDef,
  Interpolation,
  NodeDef,
  Paragraph,
  Text,
} from './ast.js';

describe('parseNodeDef — block shape', () => {
  it('parses `#sidebar body sidebar#`', () => {
    const doc = parse('#sidebar\nbody text\nsidebar#');
    expect(doc.children).toHaveLength(1);
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.name).toBe('sidebar');
    expect(def.shape).toBe('block');
    expect(def.additive).toBe(false);
    expect(def.captures).toEqual([]);
  });
});

describe('parseNodeDef — single-line shape', () => {
  it('parses `#year: 1923 !!`', () => {
    const doc = parse('#year: 1923 !!');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.name).toBe('year');
    expect(def.shape).toBe('single-line');
    expect(def.body).toHaveLength(1);
  });

  it('M7.fix-whitespace: trims trailing whitespace before !!', () => {
    // Regression: `#year: 1923 !!` captured `1923 ` (trailing space)
    // and `@year` spliced "1923 " mid-prose → `1923 ,` artefacts.
    const doc = parse('#year: 1923 !!');
    const def = doc.children[0] as NodeDef;
    const text = def.body[0] as Text;
    expect(text.kind).toBe('text');
    expect(text.value).toBe('1923');
  });

  it('M7.fix-whitespace: trims trailing tabs/newlines too', () => {
    const doc = parse('#x: alpha\t\n');
    const def = doc.children[0] as NodeDef;
    const text = def.body[0] as Text;
    expect(text.value).toBe('alpha');
  });

  it('M2.fix bug-2: three back-to-back single-line defs each parse', () => {
    // Regression: previously only the first def was recognized; the
    // newline+next-`#` was absorbed into a stray Paragraph.
    const src = '#year: 1923 !!\n#place: Dunmore Head !!\n#keeper: Vane !!';
    const doc = parse(src);
    expect(doc.children).toHaveLength(3);
    expect((doc.children[0] as NodeDef).name).toBe('year');
    expect((doc.children[1] as NodeDef).name).toBe('place');
    expect((doc.children[2] as NodeDef).name).toBe('keeper');
    for (const def of doc.children) {
      expect((def as NodeDef).shape).toBe('single-line');
    }
  });

  it('M2.fix bug-2 rule (b): `#x: value` without !! terminates at EOL+#', () => {
    // No `!!` on either line; the newline+`#y` terminates `#x`.
    const doc = parse('#x: alpha\n#y: beta\n');
    expect(doc.children).toHaveLength(2);
    const x = doc.children[0] as NodeDef;
    const y = doc.children[1] as NodeDef;
    expect(x.shape).toBe('single-line');
    expect(y.shape).toBe('single-line');
    expect(x.name).toBe('x');
    expect(y.name).toBe('y');
  });

  it('M2.fix bug-2 rule (b): `#x: value` without !! terminates at EOF', () => {
    const doc = parse('#x: lone value');
    expect(doc.children).toHaveLength(1);
    const x = doc.children[0] as NodeDef;
    expect(x.shape).toBe('single-line');
    expect(x.name).toBe('x');
  });

  it('M2.fix bug-2 rule (b): `#x: value` terminates at paragraph break', () => {
    const doc = parse('#x: value-here\n\nA following paragraph.');
    expect(doc.children).toHaveLength(2);
    const x = doc.children[0] as NodeDef;
    expect(x.shape).toBe('single-line');
  });
});

describe('parseNodeDef — value-block shape', () => {
  it('parses multi-line value with `!!` terminator', () => {
    const src = '#epigraph:\nThe sea does not forgive.\n— proverb\n!!';
    const doc = parse(src);
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('value-block');
    expect(def.body.length).toBeGreaterThan(0);
  });
});

describe('parseNodeDef — captures', () => {
  it('parses `#x ||a, b||` capture list', () => {
    const doc = parse('#x ||a, b||\nbody\nx#');
    const def = doc.children[0] as NodeDef;
    expect(def.captures).toEqual(['a', 'b']);
  });

  it('infers captures from body when ||...|| omitted (single-line)', () => {
    const doc = parse('#cite: ::author:: (::year::) !!');
    const def = doc.children[0] as NodeDef;
    expect(def.captures).toEqual(['author', 'year']);
  });

  it('infers captures from body when ||...|| omitted (block)', () => {
    const doc = parse('#callout\nFrom ::source::: ::body::.\ncallout#');
    const def = doc.children[0] as NodeDef;
    expect(def.captures).toEqual(['source', 'body']);
  });

  it('explicit ||a|| wins over body interpolations', () => {
    const doc = parse('#x ||a||: ::a:: ::b:: !!');
    const def = doc.children[0] as NodeDef;
    expect(def.captures).toEqual(['a']);
  });
});

describe('parseNodeDef — additive prefix', () => {
  it('parses `+#x: y !!` as additive single-line', () => {
    const doc = parse('+#x: y !!');
    const def = doc.children[0] as NodeDef;
    expect(def.additive).toBe(true);
    expect(def.shape).toBe('single-line');
    expect(def.name).toBe('x');
  });
});

describe('M7.datadef-classify — pure record/collection bodies', () => {
  it('classifies `#x: { a - 1 } !!` as DataDef, not NodeDef', () => {
    const doc = parse('#x: { a - 1 } !!');
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    expect(def.name).toBe('x');
    expect(def.value.kind).toBe('record');
  });

  it('classifies a pure collection body `#xs: [ a, b ] !!` as DataDef', () => {
    const doc = parse('#xs: [ a, b ] !!');
    const def = doc.children[0] as DataDef;
    expect(def.kind).toBe('dataDef');
    expect(def.value.kind).toBe('collection');
  });

  it('keeps NodeDef for plain text single-line defs (`#x: text !!`)', () => {
    const doc = parse('#x: text !!');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
  });

  it('keeps NodeDef when value mixes interpolation with text content', () => {
    // `#cite: ::author:: (::year::) !!` — has interpolation tokens, not
    // a pure record/collection literal. Must stay NodeDef.
    const doc = parse('#cite ||author, year||: ::author:: (::year::) !!');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.shape).toBe('single-line');
  });

  it('keeps NodeDef for additive single-line defs with record literal', () => {
    // Additive defs feed merge logic — reclassifying mid-stack would
    // surprise the resolver. Leave as NodeDef for now (OUT OF SCOPE).
    const doc = parse('+#x: { a - 1 } !!');
    const def = doc.children[0] as NodeDef;
    expect(def.kind).toBe('nodeDef');
    expect(def.additive).toBe(true);
  });
});

describe('parseNodeDef — interpolation', () => {
  it('parses `::name::` as Interpolation in def body', () => {
    const doc = parse('#g ||name||\nHello, ::name::.\ng#');
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('block');
    const para = def.body[0] as Paragraph;
    expect(para.kind).toBe('paragraph');
    const interp = para.children.find(
      (c): c is Interpolation => c.kind === 'interpolation',
    );
    expect(interp?.name).toBe('name');
  });
});

describe('parseNodeDef — body slot', () => {
  it('parses `...` standalone as BodySlot marker', () => {
    const doc = parse('#wrapper\n...\nwrapper#');
    const def = doc.children[0] as NodeDef;
    expect(def.shape).toBe('block');
    const para = def.body[0] as Paragraph;
    const slot = para.children.find((c) => c.kind === 'bodySlot');
    expect(slot).toBeTruthy();
  });
});
