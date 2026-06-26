// `wit-skill init` — copies the package's skill/ subtree (SKILL.md plus
// supporting files such as examples/) into
// `<dir>/.claude/skills/<name>/`. Default <dir> is cwd; default <name>
// is `wit`. `--force` overwrites existing files in place.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CliIo } from './bin.js';
import { SKILL_DIR, SKILL_NAME } from './index.js';

interface InitOptions {
  dir: string;
  name: string;
  force: boolean;
}

export function runInit(args: readonly string[], io: CliIo): number {
  const opts = parseArgs(args, io);
  if (opts === null) return 2;
  const targetDir = path.resolve(opts.dir, '.claude', 'skills', opts.name);
  const skillMdTarget = path.join(targetDir, 'SKILL.md');
  if (fs.existsSync(skillMdTarget) && !opts.force) {
    io.stderr(
      `wit-skill init: ${skillMdTarget} already exists. Pass --force to overwrite.\n`,
    );
    return 1;
  }
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    copyDir(SKILL_DIR, targetDir);
  } catch (err) {
    io.stderr(`wit-skill init: ${(err as Error).message}\n`);
    return 1;
  }
  io.stdout(`installed: ${targetDir}/\n`);
  return 0;
}

function copyDir(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

function parseArgs(args: readonly string[], io: CliIo): InitOptions | null {
  const opts: InitOptions = { dir: process.cwd(), name: SKILL_NAME, force: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--force' || arg === '-f') { opts.force = true; continue; }
    if (arg === '--dir' || arg === '-d') {
      const v = args[i + 1];
      if (v === undefined) { io.stderr(`wit-skill init: --dir requires a value\n`); return null; }
      opts.dir = v; i += 1; continue;
    }
    if (arg === '--name' || arg === '-n') {
      const v = args[i + 1];
      if (v === undefined) { io.stderr(`wit-skill init: --name requires a value\n`); return null; }
      opts.name = v; i += 1; continue;
    }
    io.stderr(`wit-skill init: unknown argument "${arg}"\n`);
    return null;
  }
  return opts;
}
