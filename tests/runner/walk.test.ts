// Unit tests for the fixture walker.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkFixtures } from './walk.js';

function makeTempFixtures(): string {
  const root = mkdtempSync(join(tmpdir(), 'wit-walk-'));
  const fixtures = join(root, 'fixtures');
  mkdirSync(fixtures, { recursive: true });
  return fixtures;
}

function touch(path: string, body = ''): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, body, 'utf8');
}

describe('walkFixtures', () => {
  it('returns an empty list for an empty fixtures dir', () => {
    const fixturesRoot = makeTempFixtures();
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out).toEqual([]);
  });

  it('collects .wit files inside category directories', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '00-lexical', 'a.wit'));
    touch(join(fixturesRoot, '00-lexical', 'b.wit'));
    touch(join(fixturesRoot, '01-prose', 'c.wit'));
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out.map((e) => e.label).sort()).toEqual([
      '00-lexical/a.wit',
      '00-lexical/b.wit',
      '01-prose/c.wit',
    ]);
  });

  it('skips files whose basename starts with underscore', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '00-lexical', '_notes.md'));
    touch(join(fixturesRoot, '00-lexical', '_draft.wit'));
    touch(join(fixturesRoot, '00-lexical', 'real.wit'));
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out.map((e) => e.label)).toEqual(['00-lexical/real.wit']);
  });

  it('skips category directories prefixed with underscore', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '_draft', 'a.wit'));
    touch(join(fixturesRoot, '00-lexical', 'a.wit'));
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out.map((e) => e.label)).toEqual(['00-lexical/a.wit']);
  });

  it('treats master.wit as the entry for multi-file subdirs', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '14-composition', 'multi', 'master.wit'));
    touch(join(fixturesRoot, '14-composition', 'multi', 'sibling.wit'));
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out.map((e) => e.label)).toEqual([
      '14-composition/multi/master.wit',
    ]);
  });

  it('ignores subdirs that have no master.wit', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '14-composition', 'orphan', 'a.wit'));
    const out = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(out).toEqual([]);
  });

  it('produces a snapshot path with .json extension', () => {
    const fixturesRoot = makeTempFixtures();
    touch(join(fixturesRoot, '00-lexical', 'x.wit'));
    const [entry] = walkFixtures({ fixturesRoot, repoRoot: fixturesRoot });
    expect(entry.snapshotPath.endsWith('x.json')).toBe(true);
  });
});
