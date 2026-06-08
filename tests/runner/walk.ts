// Walks `tests/fixtures/<NN>-*/` discovering `.wit` files to snapshot.
//
// Skips:
// - Files / directories whose basename starts with `_` (e.g. `_notes.md`).
// - Any non-`.wit` file at the leaf level.
//
// For multi-file fixtures (subdirectories whose name does not start with
// `_`), only the `master.wit` entry-point is processed; sibling `.wit`
// files in that subdirectory are skipped because they are pulled in via
// composition / additive merging from the master.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface FixtureEntry {
  // Absolute path to the `.wit` source file.
  witPath: string;
  // Absolute path of the sibling snapshot (`.wit` → `.json`).
  snapshotPath: string;
  // Repo-relative human label for test names.
  label: string;
}

export interface WalkOptions {
  // Absolute path to `tests/fixtures/`.
  fixturesRoot: string;
  // Absolute path used to compute labels (typically the repo root).
  repoRoot: string;
}

export function walkFixtures(opts: WalkOptions): FixtureEntry[] {
  const out: FixtureEntry[] = [];
  for (const cat of listCategoryDirs(opts.fixturesRoot)) {
    collectFromCategory(cat, opts, out);
  }
  out.sort((a, b) => a.witPath.localeCompare(b.witPath));
  return out;
}

function listCategoryDirs(fixturesRoot: string): string[] {
  const entries = safeReaddir(fixturesRoot);
  const dirs: string[] = [];
  for (const name of entries) {
    if (name.startsWith('_')) continue;
    const full = join(fixturesRoot, name);
    if (isDir(full)) dirs.push(full);
  }
  dirs.sort();
  return dirs;
}

function collectFromCategory(
  catDir: string,
  opts: WalkOptions,
  out: FixtureEntry[]
): void {
  for (const name of safeReaddir(catDir)) {
    if (name.startsWith('_')) continue;
    const full = join(catDir, name);
    if (isDir(full)) {
      collectFromMultiFile(full, opts, out);
      continue;
    }
    if (!name.endsWith('.wit')) continue;
    out.push(makeEntry(full, opts));
  }
}

function collectFromMultiFile(
  subDir: string,
  opts: WalkOptions,
  out: FixtureEntry[]
): void {
  // Multi-file fixtures: process the `master.wit` only.
  const master = join(subDir, 'master.wit');
  if (!isFile(master)) return;
  out.push(makeEntry(master, opts));
}

function makeEntry(witPath: string, opts: WalkOptions): FixtureEntry {
  const snapshotPath = witPath.replace(/\.wit$/, '.json');
  const label = relative(opts.repoRoot, witPath);
  return { witPath, snapshotPath, label };
}

function safeReaddir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
