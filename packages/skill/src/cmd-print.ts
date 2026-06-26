// `wit-skill print [topic]` — writes a skill file to stdout. Useful for
// piping into other tools or rendering inline in scripts.
//
// With no topic, prints SKILL.md. With a topic name, prints the
// matching reference/ or examples/ file. `wit-skill print topics`
// lists the available topic names.

import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { CliIo } from './bin.js';
import { SKILL_DIR, SKILL_MD } from './index.js';

interface TopicEntry {
  name: string;
  path: string;
  blurb: string;
}

export function runPrint(args: readonly string[], io: CliIo): number {
  if (args.length === 0) {
    io.stdout(SKILL_MD);
    return 0;
  }
  if (args.length > 1) {
    io.stderr(`wit-skill print: at most one topic argument allowed\n`);
    return 2;
  }
  const topic = args[0]!;
  if (topic === 'topics' || topic === '--list') {
    return listTopics(io);
  }
  const entry = resolveTopic(topic);
  if (entry === null) {
    io.stderr(
      `wit-skill print: unknown topic "${topic}"\n` +
      `Run \`wit-skill print topics\` to see the list.\n`,
    );
    return 2;
  }
  io.stdout(readFileSync(entry.path, 'utf8'));
  return 0;
}

function listTopics(io: CliIo): number {
  const entries = scanTopics();
  io.stdout('Available topics:\n\n');
  for (const e of entries) {
    io.stdout(`  ${e.name.padEnd(22)} ${e.blurb}\n`);
  }
  io.stdout('\nUse: wit-skill print <topic>\n');
  return 0;
}

function resolveTopic(topic: string): TopicEntry | null {
  const entries = scanTopics();
  for (const e of entries) {
    if (e.name === topic) return e;
  }
  return null;
}

// Topic names are derived from filenames: `reference/04-citations.md`
// becomes `citations`, `examples/quickstart.wit` becomes `quickstart`.
// The numeric prefix is stripped so callers don't need to remember it.
function scanTopics(): TopicEntry[] {
  const entries: TopicEntry[] = [];
  pushDir(join(SKILL_DIR, 'reference'), 'reference', entries);
  pushDir(join(SKILL_DIR, 'examples'), 'example', entries);
  return entries;
}

function pushDir(dir: string, kind: string, entries: TopicEntry[]): void {
  let files: string[];
  try { files = readdirSync(dir); } catch { return; }
  for (const file of files.sort()) {
    const ext = extname(file);
    if (ext !== '.md' && ext !== '.wit') continue;
    const slug = file.replace(/^\d+-/, '').replace(/\.(md|wit)$/, '');
    entries.push({
      name: slug,
      path: join(dir, file),
      blurb: `(${kind}) ${file}`,
    });
  }
}
