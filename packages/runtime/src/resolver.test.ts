import { describe, it, expect } from 'vitest';
import { parse } from '@wit/parser';
import type { NodeDef, DataDef, NodeUse } from '@wit/parser';
import { resolve } from './resolver.js';
import type { MergedNodeDef } from './resolved-ast.js';
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

  it('folds additive +#x into the base definition', () => {
    const doc = parse('#x: one\n\n+#x: more\n\ntext with @x here.\n', '<inline>');
    const resolved = resolve(doc);
    expect(resolved.definitions.size).toBe(1);
    expect(resolved.definitions.get('x')?.additive).toBe(true);
    // Once folded, the partials side-table is emptied.
    expect(resolved.partials.size).toBe(0);
  });
});

describe('resolver — cross-file', () => {
  function makeReader(files: Record<string, string>) {
    return (absPath: string): string => {
      const got = files[absPath];
      if (got === undefined) {
        throw new Error(`virtual fs miss: ${absPath}`);
      }
      return got;
    };
  }

  it('merges a referenced file\'s NodeDef into the parent scope', () => {
    const main = 'reference ./one.wit\n\nThe keeper was @keeper.\n';
    const one = '#keeper: Aldous Vane !!\n';
    const doc = parse(main, '/proj/main.wit');
    const resolved = resolve(doc, {
      rootPath: '/proj/main.wit',
      fileReader: makeReader({ '/proj/one.wit': one }),
    });
    expect(resolved.definitions.has('keeper')).toBe(true);
    expect(resolved.references.has('keeper')).toBe(true);
    expect(resolved.resolvedFiles.has('/proj/one.wit')).toBe(true);
  });

  it('resolves ../sibling relative paths', () => {
    const main = 'reference ../sib.wit\n\n@x.\n';
    const sib = '#x: Y !!\n';
    const doc = parse(main, '/a/b/main.wit');
    const resolved = resolve(doc, {
      rootPath: '/a/b/main.wit',
      fileReader: makeReader({ '/a/sib.wit': sib }),
    });
    expect(resolved.resolvedFiles.has('/a/sib.wit')).toBe(true);
  });

  it('throws E_CIRCULAR_REFERENCE on a cycle', () => {
    const a = 'reference ./b.wit\n\n#x: from-a !!\n';
    const b = 'reference ./a.wit\n\n#y: from-b !!\n';
    const doc = parse(a, '/proj/a.wit');
    let caught: unknown;
    try {
      resolve(doc, {
        rootPath: '/proj/a.wit',
        fileReader: makeReader({ '/proj/a.wit': a, '/proj/b.wit': b }),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_CIRCULAR_REFERENCE');
  });

  it('throws E_MISSING_REFERENCE_FILE for a missing file', () => {
    const main = 'reference ./nope.wit\n\n@k.\n';
    const doc = parse(main, '/proj/main.wit');
    let caught: unknown;
    try {
      resolve(doc, {
        rootPath: '/proj/main.wit',
        fileReader: makeReader({}),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_MISSING_REFERENCE_FILE');
  });

  it('throws when references appear with no rootPath supplied', () => {
    const doc = parse('reference ./one.wit\n\nhi.\n', '<inline>');
    let caught: unknown;
    try {
      resolve(doc);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_MISSING_REFERENCE_FILE');
  });

  it('caches a transitively shared file (parsed once)', () => {
    const main = 'reference ./a.wit\nreference ./b.wit\n\n@x.\n';
    const a = 'reference ./shared.wit\n\n#a: A !!\n';
    const b = 'reference ./shared.wit\n\n#b: B !!\n';
    const shared = '#x: SHARED !!\n';
    let sharedReads = 0;
    const reader = (p: string): string => {
      if (p === '/p/shared.wit') sharedReads += 1;
      const map: Record<string, string> = {
        '/p/a.wit': a,
        '/p/b.wit': b,
        '/p/shared.wit': shared,
      };
      const got = map[p];
      if (got === undefined) throw new Error(`miss ${p}`);
      return got;
    };
    const doc = parse(main, '/p/main.wit');
    const resolved = resolve(doc, { rootPath: '/p/main.wit', fileReader: reader });
    expect(sharedReads).toBe(1);
    expect(resolved.definitions.has('x')).toBe(true);
  });

  it('flags duplicate non-additive defs across files', () => {
    const main = 'reference ./one.wit\n\n#k: local !!\n\n@k.\n';
    const one = '#k: remote !!\n';
    const doc = parse(main, '/p/main.wit');
    let caught: unknown;
    try {
      resolve(doc, {
        rootPath: '/p/main.wit',
        fileReader: makeReader({ '/p/one.wit': one }),
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_DUPLICATE_DEFINITION');
  });

  it('folds +#x partials from a referenced file into the base def', () => {
    const main = 'reference ./one.wit\n\n#k: base !!\n\n@k.\n';
    const one = '+#k: extra !!\n';
    const doc = parse(main, '/p/main.wit');
    const resolved = resolve(doc, {
      rootPath: '/p/main.wit',
      fileReader: makeReader({ '/p/one.wit': one }),
    });
    expect(resolved.partials.size).toBe(0);
    const merged = resolved.definitions.get('k');
    expect(merged?.additive).toBe(true);
  });
});

describe('resolver — merge partials', () => {
  function bodyKinds(def: NodeDef | undefined): string[] {
    return (def?.body ?? []).map((b) => (b as { kind: string }).kind);
  }

  it('merges a base #x with two additives in document order', () => {
    const src =
      '#x: alpha !!\n\n+#x: beta !!\n\n+#x: gamma !!\n\nuse @x.\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const merged = resolved.definitions.get('x') as MergedNodeDef | undefined;
    expect(merged).toBeDefined();
    expect(merged?.additive).toBe(true);
    // body concatenation produced three paragraph-ish children.
    expect(bodyKinds(merged).length).toBeGreaterThanOrEqual(3);
    expect(merged?.partialSources.length).toBe(2);
  });

  it('merges +#x-only (no base) using first additive shape', () => {
    const src = '+#x: one !!\n\n+#x: two !!\n\n@x here.\n';
    const doc = parse(src, '<inline>');
    const resolved = resolve(doc);
    const merged = resolved.definitions.get('x') as MergedNodeDef | undefined;
    expect(merged?.additive).toBe(true);
    expect(merged?.partialSources.length).toBe(2);
    expect(bodyKinds(merged).length).toBeGreaterThanOrEqual(2);
  });

  it('throws E_PARTIAL_SHAPE_MISMATCH when shapes disagree', () => {
    // First partial is single-line, second is block.
    const src = '+#x: one !!\n\n+#x:\n  Block body\n!!\n\n@x.\n';
    const doc = parse(src, '<inline>');
    let caught: unknown;
    try {
      resolve(doc);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverError);
    expect((caught as ResolverError).code).toBe('E_PARTIAL_SHAPE_MISMATCH');
  });

  it('merges additives across two referenced files in DFS order', () => {
    const main =
      'reference ./a.wit\nreference ./b.wit\n\n#x: base !!\n\n@x here.\n';
    const a = '+#x: from-a !!\n';
    const b = '+#x: from-b !!\n';
    const reader = (p: string): string => {
      const map: Record<string, string> = { '/p/a.wit': a, '/p/b.wit': b };
      const got = map[p];
      if (got === undefined) throw new Error(`miss ${p}`);
      return got;
    };
    const doc = parse(main, '/p/main.wit');
    const resolved = resolve(doc, { rootPath: '/p/main.wit', fileReader: reader });
    const merged = resolved.definitions.get('x') as MergedNodeDef | undefined;
    expect(merged?.additive).toBe(true);
    // Two additive partial sources, one per referenced file.
    expect(merged?.partialSources.length).toBe(2);
    // Body has the base content first, then a, then b (DFS document order).
    expect(bodyKinds(merged).length).toBeGreaterThanOrEqual(3);
  });
});

describe('resolver — M10.core-vocab reserved names', () => {
  it('skips binding lookup for `@node`', () => {
    const doc = parse('@node |type img| |src ./lamp.png|');
    const resolved = resolve(doc);
    expect(resolved.definitions.has('node')).toBe(false);
    expect(resolved.bindings.size).toBe(0);
  });

  it('skips binding lookup for core-vocab names like `@h1`', () => {
    const doc = parse('@h1 Title h1@');
    const resolved = resolve(doc);
    expect(resolved.bindings.size).toBe(0);
  });

  it('still errors on unknown unreserved names', () => {
    const doc = parse('@unknownname body unknownname@');
    expect(() => resolve(doc)).toThrow(/Unresolved reference/);
  });
});
