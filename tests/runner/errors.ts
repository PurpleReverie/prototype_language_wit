// Error-fixture harness. Each `<name>.wit` in `tests/errors/` pairs with
// a `<name>.err.json` sidecar describing the expected error:
//   { "code": "E_...", "message_contains": "...", "loc": { "line": N, "col": N } }
//
// `runErrorFixture` parses the `.wit` source, catches any thrown error,
// and compares it against the sidecar. `message_contains` is matched as a
// case-insensitive substring (the sidecar contract treats it as "lowercase
// substring the diagnostic must include"). `loc.line` / `loc.col` are
// checked only when present in the sidecar.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { parse } from '@witlang/parser';

export interface ExpectedError {
  code: string;
  message_contains: string;
  loc?: { line: number; col: number };
}

export interface ErrorFixtureEntry {
  // Absolute path to the `.wit` source file.
  witPath: string;
  // Absolute path to the sibling `.err.json` sidecar.
  sidecarPath: string;
  // Repo-relative human label for the test name.
  label: string;
}

export interface ErrorFixtureResult {
  status: 'pass' | 'fail';
  // Human-readable explanation when status === 'fail'.
  reason?: string;
}

export interface WalkErrorsOptions {
  errorsRoot: string;
  repoRoot: string;
}

export function walkErrorFixtures(opts: WalkErrorsOptions): ErrorFixtureEntry[] {
  const out: ErrorFixtureEntry[] = [];
  for (const name of safeReaddir(opts.errorsRoot)) {
    if (name.startsWith('_')) continue;
    const full = join(opts.errorsRoot, name);
    if (isDir(full)) continue; // companion files for multi-file fixtures
    if (!name.endsWith('.wit')) continue;
    const sidecarPath = full.replace(/\.wit$/, '.err.json');
    if (!isFile(sidecarPath)) continue;
    out.push({
      witPath: full,
      sidecarPath,
      label: relative(opts.repoRoot, full),
    });
  }
  out.sort((a, b) => a.witPath.localeCompare(b.witPath));
  return out;
}

export function runErrorFixture(entry: ErrorFixtureEntry): ErrorFixtureResult {
  const source = readFileSync(entry.witPath, 'utf8');
  const expected = readSidecar(entry.sidecarPath);
  const thrown = parseAndCatch(source, basename(entry.witPath));
  if (thrown === null) {
    return { status: 'fail', reason: 'parser did not throw' };
  }
  return compareError(thrown, expected);
}

interface ThrownError {
  code: unknown;
  message: unknown;
  loc: unknown;
}

function parseAndCatch(source: string, file: string): ThrownError | null {
  try {
    parse(source, file);
    return null;
  } catch (e) {
    const err = e as { code?: unknown; message?: unknown; loc?: unknown };
    return {
      code: err.code,
      message: typeof err.message === 'string' ? err.message : String(e),
      loc: err.loc,
    };
  }
}

function compareError(
  actual: ThrownError,
  expected: ExpectedError
): ErrorFixtureResult {
  const codeFail = checkCode(actual.code, expected.code);
  if (codeFail) return { status: 'fail', reason: codeFail };
  const msgFail = checkMessage(actual.message, expected.message_contains);
  if (msgFail) return { status: 'fail', reason: msgFail };
  if (expected.loc) {
    const locFail = checkLoc(actual.loc, expected.loc);
    if (locFail) return { status: 'fail', reason: locFail };
  }
  return { status: 'pass' };
}

function checkCode(actual: unknown, expected: string): string | null {
  if (actual === expected) return null;
  return `code mismatch: expected ${expected}, got ${describe(actual)}`;
}

function checkMessage(actual: unknown, needle: string): string | null {
  if (typeof actual !== 'string') {
    return `message missing (got ${describe(actual)})`;
  }
  if (actual.toLowerCase().includes(needle.toLowerCase())) return null;
  return `message does not contain ${JSON.stringify(needle)} (got ${JSON.stringify(actual)})`;
}

function checkLoc(
  actual: unknown,
  expected: { line: number; col: number }
): string | null {
  if (actual === null || typeof actual !== 'object') {
    return `loc missing (got ${describe(actual)})`;
  }
  const loc = actual as { line?: unknown; col?: unknown };
  if (loc.line !== expected.line || loc.col !== expected.col) {
    return (
      `loc mismatch: expected ${expected.line}:${expected.col}, ` +
      `got ${describe(loc.line)}:${describe(loc.col)}`
    );
  }
  return null;
}

function readSidecar(path: string): ExpectedError {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const code = raw.code;
  const messageContains = raw.message_contains;
  if (typeof code !== 'string' || typeof messageContains !== 'string') {
    throw new Error(`malformed sidecar: ${path}`);
  }
  const result: ExpectedError = { code, message_contains: messageContains };
  if (raw.loc && typeof raw.loc === 'object') {
    const loc = raw.loc as { line?: unknown; col?: unknown };
    if (typeof loc.line === 'number' && typeof loc.col === 'number') {
      result.loc = { line: loc.line, col: loc.col };
    }
  }
  return result;
}

function describe(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (v === undefined) return 'undefined';
  return JSON.stringify(v);
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
