import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import type { NodeDef, DataDef, NodeUse } from '@wit/parser';
import { resolve } from './resolver.js';
import { ResolverError } from './errors.js';

function firstUse(blocks: readonly unknown[]): NodeUse {
  for (const block of blocks) {
    const b = block as { kind: string };
    if (b.kind === 'nodeUse') return b as unknown as NodeUse;
    if (b.kind === 'paragraph') {
      const para = b as unknown as { children: { kind: string }[] };
      const found = para.children.find((c) => c.kind === 'nodeUse');
      if (found) return found as unknown as NodeUse;
    }
  }
  throw new Error('no NodeUse found in document');
}

describe('resolver scaffold', () => {
  it('produces a resolved-document shape from a one-line doc', () => {
    const doc = parse('Hello Wit\n', '<inline>');
    const resolved = resolve(doc);
    expect(resolved.kind).toBe('resolved-document');
    expect(resolved.children).toBe(doc.children);
    expect(resolved.definitions.size).toBe(0);
    expect(resolved.references.size).toBe(0);
    expect(resolved.loc).toBe(doc.loc);
  });

  it('accepts an options object', () => {
    const doc = parse('x\n', '<inline>');
    const resolved = resolve(doc, {});
    expect(resolved.kind).toBe('resolved-document');
  });
});

describe('resolver — bind refs', () => {
  it('binds @x to #x within the same file', () => {
    const doc = parse('#greeting: Hello\n\nsays @greeting today.\n', '<inline>');
    const resolved = resolve(doc);
    expect(resolved.definitions.has('greeting')).toBe(true);
    expect(resolved.references.has('greeting')).toBe(true);
    const use = firstUse(doc.children);
    const bound = resolved.bindings.get(use) as NodeDef | undefined;
    expect(bound?.kind).toBe('nodeDef');
    expect(bound?.name).toBe('greeting');
  });

  it('throws E_UNRESOLVED_REFERENCE when @x has no definition', () => {
    const doc = parse('says @nope today.\n', '<inline>');
    let caught: unknown;
    try {
      resolve(doc);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_UNRESOLVED_REFERENCE');
    expect((caught as ResolverError).message).toContain('@nope');
  });

  it('throws E_DUPLICATE_DEFINITION for repeated non-additive #x', () => {
    const doc = parse('#x: one\n\n#x: two\n', '<inline>');
    let caught: unknown;
    try {
      resolve(doc);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_DUPLICATE_DEFINITION');
  });

  it('binds @x.y dotted access to a DataDef of the same name', () => {
    const doc = parse('#person: { name - Ada }\n\nhi @person.name today.\n', '<inline>');
    const resolved = resolve(doc);
    const use = firstUse(doc.children);
    const bound = resolved.bindings.get(use) as DataDef | NodeDef | undefined;
    expect(bound).toBeDefined();
    expect(bound?.name).toBe('person');
    expect(resolved.references.has('person')).toBe(true);
  });

  it('skips additive +#x defs during collection', () => {
    const doc = parse('#x: one\n\n+#x: more\n\ntext with @x here.\n', '<inline>');
    const resolved = resolve(doc);
    expect(resolved.definitions.size).toBe(1);
    expect(resolved.definitions.get('x')?.additive).toBe(false);
  });
});
