// `wit build <file> [-o output.html]` — parse + resolve + expand the
// file then render it to HTML. Writes to the -o path if given, else
// stdout.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse, WitError } from '@wit/parser';
import { resolve, expand, RuntimeError } from '@wit/runtime';
import { renderHtml } from '@wit/render-html';
import type { CliIo } from './bin.js';

export interface BuildArgs {
  file: string;
  outPath: string | undefined;
}

export function runBuild(args: readonly string[], io: CliIo): number {
  const parsed = parseArgs(args, io);
  if (parsed === null) return 2;
  const source = readSource(parsed.file, io);
  if (source === null) return 1;
  return performBuild(parsed, source, io);
}

function parseArgs(args: readonly string[], io: CliIo): BuildArgs | null {
  let file: string | undefined;
  let outPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '-o' || a === '--out') {
      outPath = args[++i];
      if (outPath === undefined) {
        io.stderr('wit build: -o requires a path\n');
        return null;
      }
    } else if (file === undefined) file = a;
    else { io.stderr(`wit build: unexpected arg "${a}"\n`); return null; }
  }
  if (file === undefined) { io.stderr('wit build: missing <file>\n'); return null; }
  return { file, outPath };
}

function readSource(file: string, io: CliIo): string | null {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (err) {
    io.stderr(`wit build: cannot read ${file}: ${(err as Error).message}\n`);
    return null;
  }
}

function performBuild(args: BuildArgs, source: string, io: CliIo): number {
  try {
    const doc = parse(source, args.file);
    const resolved = resolve(doc, { rootPath: path.resolve(args.file) });
    const expanded = expand(resolved);
    const html = renderHtml(expanded);
    return emit(html, args.outPath, args.file, io);
  } catch (err) {
    io.stderr(formatStageError(err, args.file));
    return 1;
  }
}

function emit(html: string, outPath: string | undefined, file: string, io: CliIo): number {
  if (outPath === undefined) { io.stdout(html); return 0; }
  try {
    fs.writeFileSync(outPath, html, 'utf8');
    io.stdout(`wrote ${outPath}\n`);
    return 0;
  } catch (err) {
    io.stderr(`wit build: cannot write ${outPath}: ${(err as Error).message}\n`);
    return 1;
  }
}

function formatStageError(err: unknown, file: string): string {
  if (err instanceof WitError || err instanceof RuntimeError) {
    const { line, col } = err.loc;
    return `${file}:${line}:${col}: ${err.code}: ${err.message}\n`;
  }
  return `wit build: ${(err as Error).message ?? String(err)}\n`;
}
