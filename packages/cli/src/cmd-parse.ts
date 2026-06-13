// `wit parse <file>` — parse the given .wit file and print AST as JSON.

import * as fs from 'node:fs';
import { parse, WitError } from '@witlang/parser';
import type { CliIo } from './bin.js';

export function runParse(args: readonly string[], io: CliIo): number {
  const file = args[0];
  if (file === undefined) {
    io.stderr('wit parse: missing <file> argument\n');
    return 2;
  }
  const source = readOrFail(file, io);
  if (source === null) return 1;
  try {
    const doc = parse(source, file);
    io.stdout(JSON.stringify(doc, null, 2) + '\n');
    return 0;
  } catch (err) {
    io.stderr(formatError(err, file));
    return 1;
  }
}

function readOrFail(file: string, io: CliIo): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    io.stderr(`wit parse: cannot read ${file}: ${(err as Error).message}\n`);
    return null;
  }
}

function formatError(err: unknown, file: string): string {
  if (err instanceof WitError) {
    const { line, col } = err.loc;
    return `${file}:${line}:${col}: ${err.code}: ${err.message}\n`;
  }
  return `wit parse: ${(err as Error).message ?? String(err)}\n`;
}
