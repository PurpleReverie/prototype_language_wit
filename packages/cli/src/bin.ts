#!/usr/bin/env node
// CLI entry. Dispatches subcommands by switching on argv[2] — no
// dependency on a CLI library (DS-18: zero runtime deps in @wit/cli).
//
// Usage:
//   wit parse <file>            Parse a .wit file, print AST as JSON.
//   wit check <file>            Parse + resolve, report errors (exit 1).
//   wit build <file> [-o out]   Render expanded HTML to stdout or file.
//   wit --version | --help

import { runParse } from './cmd-parse.js';
import { runCheck } from './cmd-check.js';
import { runBuild } from './cmd-build.js';

export const VERSION = '0.1.0';

export const HELP_TEXT = [
  'wit v' + VERSION,
  '',
  'Usage:',
  '  wit parse <file>',
  '  wit check <file>',
  '  wit build <file> [-o output.html]',
  '  wit --version | --help',
].join('\n');

export interface CliIo {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
}

export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  const cmd = argv[0];
  if (cmd === undefined || cmd === '--help' || cmd === '-h') {
    io.stdout(HELP_TEXT + '\n');
    return 0;
  }
  if (cmd === '--version' || cmd === '-v') {
    io.stdout(VERSION + '\n');
    return 0;
  }
  return await dispatch(cmd, argv.slice(1), io);
}

async function dispatch(cmd: string, rest: readonly string[], io: CliIo): Promise<number> {
  if (cmd === 'parse') return runParse(rest, io);
  if (cmd === 'check') return runCheck(rest, io);
  if (cmd === 'build') return runBuild(rest, io);
  io.stderr(`wit: unknown command "${cmd}"\n${HELP_TEXT}\n`);
  return 2;
}

// Direct invocation guard — only run main when this module is the entry point.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const io: CliIo = {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
  };
  runCli(process.argv.slice(2), io).then((code) => {
    process.exit(code);
  }, (err: unknown) => {
    io.stderr(`wit: fatal: ${(err as Error).message ?? String(err)}\n`);
    process.exit(1);
  });
}
