#!/usr/bin/env node
// CLI entry for @witlang/skill. Dispatches subcommands by switching on
// argv[2] — no dependency on a CLI library, matching @witlang/cli.
//
// Usage:
//   wit-skill init [--dir <path>] [--name <skill-name>] [--force]
//   wit-skill print [<topic>]
//   wit-skill print topics
//   wit-skill --version | --help
//
// `init` copies the package's skill/ subtree into
// <dir>/.claude/skills/<name>/ so Claude Code picks it up automatically.
// `print` writes a skill file to stdout: SKILL.md with no argument, a
// specific reference/ or example file when a topic is given.
// `print topics` lists the available topic names.

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInit } from './cmd-init.js';
import { runPrint } from './cmd-print.js';

export const VERSION = '0.1.0';

export const HELP_TEXT = [
  'wit-skill v' + VERSION,
  '',
  'Usage:',
  '  wit-skill init [--dir <path>] [--name <skill-name>] [--force]',
  '  wit-skill print [<topic>]',
  '  wit-skill print topics',
  '  wit-skill --version | --help',
  '',
  'init copies the Wit authoring skill into:',
  '  <dir>/.claude/skills/<name>/',
  '  Defaults: --dir cwd, --name wit. --force overwrites.',
  '',
  'print writes a skill file to stdout — SKILL.md by default, or a',
  'specific topic (e.g. `wit-skill print citations`). Run',
  '`wit-skill print topics` to list available topics.',
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
  if (cmd === 'init') return runInit(rest, io);
  if (cmd === 'print') return runPrint(rest, io);
  io.stderr(`wit-skill: unknown command "${cmd}"\n${HELP_TEXT}\n`);
  return 2;
}

// Direct invocation guard — only run main when this module is the entry point.
const invokedDirectly = (() => {
  try {
    return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const io: CliIo = {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
  };
  runCli(process.argv.slice(2), io).then((code) => {
    process.exitCode = code;
  });
}
