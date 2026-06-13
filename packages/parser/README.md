# @witlang/parser

The Wit language parser. Reads Wit source and produces a typed AST.

## What this parses

```wit
Plain prose with _italic_ and *bold* emphasis.
```

Produces a `paragraph` block whose children include `text`, `italic`,
and `bold` inline nodes.

```wit
#person
  name: Aldous Vane
  years at post: 31
person#
```

Produces a `dataDef` named `person` whose value is a `record` with two
typed fields (`name` → `stringValue`, `years at post` → `numberValue`).

```wit
@greeting ||name||
Hello, ::name::.
greeting#
```

Produces a `nodeDef` named `greeting` with one declared capture
(`name`) and a body containing a single `paragraph` with an
`interpolation` referencing the captured value.

## Public API

`@witlang/parser` exposes a small, curated surface. See `src/index.ts` for
the canonical list. The main entry is `parse(source, file?)` which
returns a `Document` node. Errors are thrown as `WitError` instances
carrying a stable `code` and a `loc`.

```ts
import { parse, WitError } from '@witlang/parser';

try {
  const doc = parse(source, '/path/to/file.wit');
  // doc.kind === 'document'
} catch (err) {
  if (err instanceof WitError) {
    console.error(`${err.code} at ${err.loc.line}:${err.loc.col}: ${err.message}`);
  }
}
```

Typed scalar values inside record fields, collection items, and
comparison RHS positions are classified at parse time:

- Integer / decimal literals (`-?[0-9]+(\.[0-9]+)?`) → `numberValue`.
- Exact lowercase `true` / `false` → `booleanValue`.
- Exact lowercase `null` → `nullValue`.
- Quoted strings (`"..."`) and anything else → `stringValue`.

## Known limitations

The v0.1.0 parser handles every shape in the language specification
**except** the three rough edges below. Each one is pinned by a
fixture under `tests/fixtures/` so regressions can't sneak in.

- **Multi-line pipe-form values** — a pipe parameter whose value
  continues across a newline (`|key value\nsecond line|`) is rejected
  or produces a garbled AST. Pinned by
  `tests/fixtures/06-parameters-pipes/multi-line-value.json`. Workaround:
  use form-fill capture (`key: value` lines inside a bodied node) or
  a quoted string.

- **Nested closing of same-named nodes** — different names nest
  cleanly (`@chapter ... @aside ... aside@ ... chapter@`), but the
  same name nesting (`@chapter ... @chapter ... chapter@ ... chapter@`)
  is ambiguous and resolves to the innermost match only. Pinned by
  `tests/fixtures/17-combinations/nested-nodes-with-params.json`.
  Workaround: rename one of the nested instances.

- **Bare tilde without trailing space** — a `~` that is not followed
  by a space at the start of a line parses as content, not as a
  comment continuation. Always write `~ ` (tilde + space) at the start
  of every comment line.

## License

See repository root.
