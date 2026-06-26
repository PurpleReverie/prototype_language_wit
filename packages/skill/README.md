# @witlang/skill

A Claude Code authoring skill for the [Wit](https://github.com/PurpleReverie/prototype_language_wit)
markup language. Drop it into a downstream project so any agent
working there writes Wit idiomatically — form-fill bodies, named
idea-citations, block-form defs — instead of reaching for pipes for
every parameter.

## Install

```sh
# in your downstream project
npx @witlang/skill init
```

This copies the skill into `.claude/skills/wit/` in the current
directory. Claude Code picks it up automatically the next time an
agent starts in that workspace.

Or install globally and reuse:

```sh
npm install -g @witlang/skill
wit-skill init                       # cwd/.claude/skills/wit/
wit-skill init --dir path/to/proj    # alternate workspace root
wit-skill init --name wit-lang       # alternate skill folder name
wit-skill init --force               # overwrite existing files
```

## What ships

The skill is a directory tree designed for **progressive disclosure**
— the entry-point SKILL.md is a short router that points at deeper
material loaded on demand. Agents only read what the current task
requires.

```
.claude/skills/wit/
  SKILL.md                         # ~150-line router — read first
  reference/
    01-invocation-forms.md         # 5 forms, when to use each
    02-defs-and-captures.md        # def shapes + ||captures||
    03-data-records-iteration.md   # records, conditionals, iteration, tables
    04-citations.md                # the argument-map citation pattern
    05-scripts-lh-bridge.md        # <% %> + lh.* API
    06-custom-renderers.md         # @witlang/runtime extension surface
    07-gotchas.md                  # parser edge cases
  examples/
    quickstart.wit                 # 10-line minimal correct doc
    preferred.wit                  # ~45 lines, realistic mini-document
    all-permutations.wit           # ~1000 lines, exhaustive catalog
```

## Other commands

```sh
wit-skill print                      # SKILL.md to stdout
wit-skill print topics               # list available topic names
wit-skill print citations            # print a single reference topic
wit-skill print quickstart           # print an example
wit-skill --version
wit-skill --help
```

`print <topic>` is the programmatic counterpart of opening one of the
files above — useful in shell pipelines or for tools that want a
single chunk of skill content without writing it to disk first.

## Programmatic use

```ts
import { SKILL_MD, SKILL_DIR, SKILL_NAME, SKILL_VERSION } from '@witlang/skill';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Inline the full SKILL.md content.
const router = SKILL_MD;

// Read a reference file by path.
const citations = readFileSync(
  join(SKILL_DIR, 'reference', '04-citations.md'),
  'utf8',
);
```

## What the skill teaches

- **The five preferred shapes**, with strong opinions on which to
  reach for first: value-block def + bare ref, record-arg with `:`,
  colon scatter, block-form def for manuscripts.
- **The underlying design principle**: content goes in node bodies,
  parameters are metadata.
- **Per-topic deep dives** — invocation forms, defs and captures,
  data and iteration, citations, the script bridge, custom renderers,
  gotchas — each in its own focused file under `reference/`.
- **Tiered examples** — pick the smallest one that answers your
  question.

## License

MIT
