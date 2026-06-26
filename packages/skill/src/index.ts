// Public surface for @witlang/skill.
//
// The package distributes a Claude Code skill — a directory tree
// rooted at `<package>/skill/`, with SKILL.md as the entry point and
// supporting files (examples, references) alongside it. The init
// binary copies the whole tree into a consumer's `.claude/skills/wit/`.
//
// Programmatic consumers can:
//   - read SKILL_MD as a string,
//   - read SKILL_DIR to locate the installed package's skill root
//     and walk additional files (examples, etc.) themselves.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// dist/index.js → ../skill/. The same relative layout holds in the
// published tarball: `skill/` sits beside `dist/` at the package root.
export const SKILL_DIR: string = resolve(HERE, '..', 'skill');
const SKILL_PATH = resolve(SKILL_DIR, 'SKILL.md');

export const SKILL_NAME = 'wit';
export const SKILL_VERSION = '0.1.0';
export const SKILL_MD: string = readFileSync(SKILL_PATH, 'utf8');
