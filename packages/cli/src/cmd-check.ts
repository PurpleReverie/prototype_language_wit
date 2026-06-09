// `wit check <file>` — parse and resolve the file, report any errors.
// Exits 0 on a clean pass, 1 if either stage threw, 2 on usage errors.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, WitError } from '@wit/parser';
import { resolve, RuntimeError } from '@wit/runtime';
import type { CliIo } from './bin.js';

export function runCheck(args: readonly string[], io: CliIo): number {
  const file = args[0];
  if (file === undefined) {
    io.stderr('wit check: missing <file> argument\n');
    return 2;
  }
  const source = readSource(file, io);
  if (source === null) return 1;
  return performCheck(file, source, io);
}

function readSource(file: string, io: CliIo): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    io.stderr(`wit check: cannot read ${file}: ${(err as Error).message}\n`);
    return null;
  }
}

function performCheck(file: string, source: string, io: CliIo): number {
  try {
    const doc = parse(source, file);
    resolve(doc, { rootPath: path.resolve(file) });
    io.stdout(`ok: ${file}\n`);
    return 0;
  } catch (err) {
    io.stderr(formatStageError(err, file));
    return 1;
  }
}

function formatStageError(err: unknown, file: string): string {
  if (err instanceof WitError || err instanceof RuntimeError) {
    const { line, col } = err.loc;
    return `${file}:${line}:${col}: ${err.code}: ${err.message}\n`;
  }
  return `wit check: ${(err as Error).message ?? String(err)}\n`;
}
