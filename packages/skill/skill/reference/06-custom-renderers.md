# Custom renderers — extending Wit to new targets

Wit ships two reference renderers — `@witlang/render-html` and
`@witlang/render-markdown` — both built on `@witlang/parser` +
`@witlang/runtime`. The same surface is what custom renderers depend
on, whether you're emitting LaTeX, RTF, a Slack message, or a custom
JSON intermediate.

## The pipeline

```
   source.wit
       │
       ▼
   ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐    ┌────────┐
   │  lex    │ -> │  parse  │ -> │ resolve  │ -> │ expand  │ -> │ render │
   │ (chars) │    │ (AST)   │    │ (binding │    │ (inline │    │ (your  │
   │         │    │         │    │  + refs) │    │  + eval)│    │  code) │
   └─────────┘    └─────────┘    └──────────┘    └─────────┘    └────────┘
              @witlang/parser            @witlang/runtime
```

Your renderer walks the **expanded** document and emits whatever
target format you want.

## Minimal renderer skeleton

```ts
import { parse } from '@witlang/parser';
import { resolve, expand } from '@witlang/runtime';
import type { ExpandedDocument } from '@witlang/runtime';

const source = fs.readFileSync('doc.wit', 'utf8');
const parsed = parse(source, 'doc.wit');
const resolved = resolve(parsed, {
  rootPath: path.resolve('doc.wit'),
  readFile: async (p) => fs.readFileSync(p, 'utf8'),
});
const expanded: ExpandedDocument = expand(resolved);

// Walk expanded.children and emit your target.
const out = renderToYourFormat(expanded);
```

## Useful runtime exports

```ts
import {
  resolve,
  expand,
  RuntimeError,
  ResolverError,
  ExpanderError,
  RuntimeErrorCode,
  CORE_VOCAB_NAMES,
  RESERVED_OPAQUE,
  isCoreVocabName,
  isReservedNodeName,
} from '@witlang/runtime';

import type {
  ResolvedDocument,
  ExpandedDocument,
  ResolveOptions,
  FileReader,
  RuntimeErrorCodeName,
} from '@witlang/runtime';
```

`CORE_VOCAB_NAMES` is the 47 reserved HTML-derived node names (`h1`
through `h6`, `em`, `strong`, `ul`, `ol`, `li`, `a`, `table`, …). Use
it to dispatch known node types to dedicated rendering branches.

## The opaque `@node(type X)` extension point

For anything outside core vocab and custom defs, an opaque node lets
authors pass arbitrary tagged content through to the renderer:

```
@node(type chart, layout horizontal)
Series A: 1, 2, 3
Series B: 4, 5, 6
node@
```

In the expanded AST, that becomes a node with `name: 'node'`,
`params: { type: 'chart', layout: 'horizontal' }`, and `content` from
the body. Your renderer dispatches on `params.type` and emits
whatever's appropriate.

> See [`08-custom-nodes.md`](./08-custom-nodes.md) for the catalog of
> common extensions — callouts, math, diagrams, footnotes,
> marginalia, drop caps, pull quotes, charts, etc. — with the shapes
> authors should use and renderer-side dispatch sketches.

## AST data structures — what your renderer walks

Every AST node is a tagged-union object with a `kind` discriminator,
position metadata (`loc`), and either children, parameters, or scalar
fields depending on what it represents. An `ExpandedDocument` is a
tree of these.

The authoritative type declarations live in `@witlang/parser/src/ast.ts`
and are re-exported through `@witlang/runtime`. The reference below
is the field-by-field map.

### Top-level shape

```ts
interface ExpandedDocument {
  kind: 'expanded-document';
  children: Block[];
  loc: Loc;
}

interface Loc {
  file: string;     // absolute path to the source file
  line: number;     // 1-based
  col: number;      // 1-based
  offset: number;   // byte offset from start of file
  length: number;   // byte length of the node's source span
}
```

`children` is a flat list of `Block` nodes; the renderer walks them
in source order. Every node carries `loc` — useful for error
messages, source-map output, or click-to-source IDE integrations.

### `Block` — block-level node variants

```ts
type Block =
  | Paragraph
  | Comment
  | NodeUse
  | NodeDef
  | DataDef
  | ReferenceDirective
  | IfStatement
  | EachStatement
  | ScriptBlock;
```

#### `Paragraph`

```ts
interface Paragraph {
  kind: 'paragraph';
  children: Inline[];
  loc: Loc;
}
```

Plain prose. Produced whenever the parser sees text outside any
container — between node closes, at the document top level, inside a
def body.

Wit `A keeper trimmed the wick.` → `{ kind: 'paragraph', children: [{ kind: 'text', value: 'A keeper trimmed the wick.', loc }], loc }`.

#### `NodeUse`

```ts
interface NodeUse {
  kind: 'nodeUse';
  name: string;
  access?: string[];      // for @thing.field.subfield → ['field', 'subfield']
  params: Param[];
  paramsSource: 'parens' | 'pipes' | 'mixed' | 'record' | 'form-fill' | 'none';
  body: (Block | Inline)[] | null;
  inline: boolean;        // true for use-in-prose, false for block-level
  closeStyle: 'named' | 'parens' | 'bare';
  loc: Loc;
}
```

A `@name` call. The most common node your renderer dispatches on.

- `name` — the node type to render. May be a core vocab name (`h1`,
  `em`, `ul`, `a`, `table`), an opaque type opener (`node` — see
  [`08-custom-nodes.md`](./08-custom-nodes.md)), or a user-defined name
  whose def has been inlined by the expander.
- `access` — dotted-access segments after the name; populated when
  the use is a data reference like `@author.name`.
- `params` — the call's named/positional arguments. See `Param` below.
- `paramsSource` — which invocation form the author used; usually
  irrelevant to the renderer but useful for diagnostics.
- `body` — the body content as parsed children, or `null` for
  self-closing calls (parens, record-arg).
- `inline` — `true` when the use sits inside a paragraph; `false`
  when it's a block on its own.
- `closeStyle` — `'named'` for `name@`, `'parens'` for self-closing
  `@x(...)`, `'bare'` for plain `@x` data references.

#### `NodeDef`

```ts
interface NodeDef {
  kind: 'nodeDef';
  name: string;
  captures: string[];                                 // ||a, b, c|| names
  shape: 'block' | 'single-line' | 'value-block';
  body: (Block | Inline | Record | Collection)[];
  additive: boolean;                                  // leading `+#name:`
  loc: Loc;
}
```

A `#name` definition. After expansion, NodeDef nodes are normally
**absent from the tree** — the expander inlines each def's body into
every site that uses it. They may survive when a def is never used
(harmlessly) or when you're walking the pre-expansion AST.

`additive: true` marks a `+#name:` partial (see
[`02-defs-and-captures.md`](./02-defs-and-captures.md) and
[`10-document-assembly.md`](./10-document-assembly.md)).

#### `DataDef`

```ts
interface DataDef {
  kind: 'dataDef';
  name: string;
  value: DataValue;   // see helper types below
  loc: Loc;
}
```

A `#name: { … }` or `#name: [ … ]` data definition. **Consumed
during binding** — does not appear in the expanded AST. Data flows
through iteration (`(each …)`) and conditionals (`(if …)`) at
expansion time.

#### `ReferenceDirective`

```ts
interface ReferenceDirective {
  kind: 'reference';
  path: string;       // 'shared/schema.wit'
  loc: Loc;
}
```

A `reference ./other.wit` line. The resolver follows them
transitively. The expanded tree usually still carries them so
tooling can inspect the dependency graph; renderers typically drop
them.

#### `IfStatement`

```ts
interface IfStatement {
  kind: 'ifStatement';
  cond: Condition;     // see helper types
  then: Block[];
  else?: Block[];
  loc: Loc;
}
```

A `(if …) … (else) … (end)` conditional. The expander evaluates
`cond` against bound data and **replaces the IfStatement with the
selected branch's content**. A surviving IfStatement in the expanded
AST means the expander couldn't evaluate it (condition on unresolved
data, for instance) — most renderers should drop or treat as
best-effort.

#### `EachStatement`

```ts
interface EachStatement {
  kind: 'eachStatement';
  collection: AccessPath;   // segments of the data path
  itemName: string;          // 'finding' in `(each @findings as finding)`
  body: Block[];
  loc: Loc;
}
```

A `(each @list as item) … (end)` loop. The expander **unrolls** these
into repeated `Block[]` content. EachStatement should not appear in
the expanded AST under normal operation.

#### `ScriptBlock`

```ts
interface ScriptBlock {
  kind: 'scriptBlock';
  content: string;     // raw JS between `<%` and `%>`
  inline: boolean;     // true when inline-in-body
  loc: Loc;
}
```

A `<% js %>` block. Runs via the `lh` bridge after expand — see
[`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md). Your
renderer either evaluates them (if you ship a `lh` runtime) or drops
them.

#### `Comment`

```ts
interface Comment {
  kind: 'comment';
  text: string;
  inline: boolean;
  loc: Loc;
}
```

A `~ comment` line. Drop these unless your target format preserves
prose comments.

### `Inline` — inline-level node variants

```ts
type Inline =
  | Text
  | Italic
  | Bold
  | Interpolation
  | BodySlot
  | NodeUse        // inline: true
  | ScriptCall
  | ScriptBlock    // inline: true
  | Comment;
```

#### `Text`

```ts
interface Text {
  kind: 'text';
  value: string;
  loc: Loc;
}
```

Literal text. The most common leaf node.

#### `Italic` / `Bold`

```ts
interface Italic { kind: 'italic'; children: Inline[]; loc: Loc; }
interface Bold   { kind: 'bold';   children: Inline[]; loc: Loc; }
```

Emphasis wrappers from `_…_` and `*…*`. Children are further inlines
(supports nesting).

#### `Interpolation`

```ts
interface Interpolation {
  kind: 'interpolation';
  name: string;       // the capture name between ::…::
  loc: Loc;
}
```

A `::name::` reference to a captured parameter inside a `NodeDef`
body. The expander substitutes these with the actual capture value
at each use site. **Should not appear in the expanded AST** — a
surviving Interpolation indicates an unbound capture.

#### `BodySlot`

```ts
interface BodySlot {
  kind: 'bodySlot';
  loc: Loc;
}
```

The `...` placeholder marking where the invocation body splices into
a def body. **Should not appear in the expanded AST** — replaced by
the inlined body content.

#### `ScriptCall`

```ts
interface ScriptCall {
  kind: 'scriptCall';
  fnName: string;      // 'randomTime' in `@scriptCall(randomTime)`
  args: string[];
  loc: Loc;
}
```

An inline `@scriptCall(fn)` reference to a function declared in an
adjacent `<% %>` block.

### Helper / value types

#### `DataValue`

```ts
type DataValue =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | Record
  | Collection;

interface StringValue  { kind: 'stringValue';  value: string;  loc: Loc; }
interface NumberValue  { kind: 'numberValue';  value: number;  loc: Loc; }
interface BooleanValue { kind: 'booleanValue'; value: boolean; loc: Loc; }
interface NullValue    { kind: 'nullValue';                    loc: Loc; }
```

Wraps scalar values used inside records, collections, and condition
comparisons. Record and Collection are also DataValues — values can
nest.

#### `Record`

```ts
interface Record {
  kind: 'record';
  fields: { key: string; value: DataValue }[];
  loc: Loc;
}
```

A `{ k - v, k - v }` literal. Fields preserve source order.

#### `Collection`

```ts
interface Collection {
  kind: 'collection';
  items: DataValue[];
  loc: Loc;
}
```

A `[ … ]` literal. Items preserve source order.

#### `Param`

```ts
interface Param {
  name: string | null;   // null for positional values
  value: string;
  loc: Loc;
}
```

A single key/value pair on a `NodeUse`. Renderers usually read
`use.params` as a list and look up named values:

```ts
function getParam(use: NodeUse, name: string): string | undefined {
  return use.params.find(p => p.name === name)?.value;
}
```

#### `AccessPath`

```ts
interface AccessPath {
  segments: string[];   // ['author', 'name'] for @author.name
  loc: Loc;
}
```

A dotted reference, used inside conditions and `each` collections.

#### `Condition`

```ts
type Condition = ExistenceCondition | ComparisonCondition;

interface ExistenceCondition {
  kind: 'existenceCondition';
  path: AccessPath;
  loc: Loc;
}

interface ComparisonCondition {
  kind: 'comparisonCondition';
  left: AccessPath;
  op: 'is' | 'equals';
  right: DataValue;
  loc: Loc;
}
```

`(if @flag)` produces `ExistenceCondition`; `(if @x is foo)` produces
`ComparisonCondition`.

### A concrete example

Source:

```
#author: { name - Mara Finch, role - lead }

#aside
Side notes survive in margins.
aside#

The keeper trimmed the wick _slowly_, then noted @aside good lamp aside@.

(if @author.role is lead)
@h2 Lead author h2@
(end)
```

Post-parse AST (with `loc` fields elided as `loc: {…}`):

```json
{
  "kind": "document",
  "children": [
    {
      "kind": "dataDef",
      "name": "author",
      "value": {
        "kind": "record",
        "fields": [
          { "key": "name", "value": { "kind": "stringValue", "value": "Mara Finch", "loc": {} } },
          { "key": "role", "value": { "kind": "stringValue", "value": "lead",       "loc": {} } }
        ],
        "loc": {}
      },
      "loc": {}
    },
    {
      "kind": "nodeDef",
      "name": "aside",
      "captures": [],
      "shape": "block",
      "additive": false,
      "body": [
        {
          "kind": "paragraph",
          "children": [{ "kind": "text", "value": "Side notes survive in margins.", "loc": {} }],
          "loc": {}
        }
      ],
      "loc": {}
    },
    {
      "kind": "paragraph",
      "children": [
        { "kind": "text",    "value": "The keeper trimmed the wick ", "loc": {} },
        { "kind": "italic",  "children": [{ "kind": "text", "value": "slowly", "loc": {} }], "loc": {} },
        { "kind": "text",    "value": ", then noted ", "loc": {} },
        { "kind": "nodeUse", "name": "aside", "params": [], "paramsSource": "none",
          "body": [{ "kind": "text", "value": "good lamp", "loc": {} }],
          "inline": true, "closeStyle": "named", "loc": {} },
        { "kind": "text",    "value": ".", "loc": {} }
      ],
      "loc": {}
    },
    {
      "kind": "ifStatement",
      "cond": {
        "kind": "comparisonCondition",
        "left":  { "segments": ["author", "role"], "loc": {} },
        "op":    "is",
        "right": { "kind": "stringValue", "value": "lead", "loc": {} },
        "loc":   {}
      },
      "then": [
        { "kind": "nodeUse", "name": "h2", "params": [], "paramsSource": "none",
          "body": [{ "kind": "text", "value": "Lead author", "loc": {} }],
          "inline": false, "closeStyle": "named", "loc": {} }
      ],
      "loc": {}
    }
  ],
  "loc": {}
}
```

After `expand(resolved)`, the `dataDef` and `nodeDef` are removed,
the `ifStatement` evaluates to its `then` content (since `author.role
== 'lead'`), and the `@aside` use site has its body inlined from the
def — producing a flat `Block[]` of just paragraphs and the
resolved `@h2`.

You can reproduce the parsed JSON with `wit parse path/to/file.wit`.

### Nodes the expander removes

After `expand(resolved)`, these `kind`s are normally absent:

| Kind | Why it disappears |
|---|---|
| `nodeDef` | inlined into bound use sites |
| `dataDef` | consumed by binding; data flows through `(each)` and `(if)` |
| `ifStatement` | evaluated to a single branch |
| `eachStatement` | unrolled into repeated body content |
| `interpolation` | substituted with the captured value |
| `bodySlot` | replaced with the use site's body content |
| `reference` | a top-of-file directive, not content |

A renderer should usually error or warn if it sees any of these in
the expanded tree — they indicate an expansion failure or that you
were handed a pre-expansion document by mistake.

### A simple recursive walker

```ts
function render(node: any): string {
  switch (node.kind) {
    case 'text':      return escape(node.value);
    case 'paragraph': return `<p>${node.children.map(render).join('')}</p>`;
    case 'italic':    return `<em>${node.children.map(render).join('')}</em>`;
    case 'bold':      return `<strong>${node.children.map(render).join('')}</strong>`;
    case 'nodeUse':   return renderNodeUse(node);
    case 'comment':   return '';
    case 'scriptBlock': return '';   // or evaluate via your `lh` runtime
    default:          return '';     // surviving nodeDef/dataDef/etc.
  }
}

function renderNodeUse(use: NodeUse): string {
  if (use.name === 'node') return renderOpaque(use);  // @node(type X)
  if (isCoreVocabName(use.name)) return renderCoreVocab(use);
  return passthrough(use);     // unknown custom name — emit body verbatim
}
```

## Cross-file `reference` resolution

Authors can include other files via `reference ./other.wit` at the
top of their document. The resolver follows references transitively.
You supply the file-reading function via `ResolveOptions.readFile` —
this is your hook for sandboxing, virtual filesystems, or network
fetches.

## Errors

Resolver and expander throw structured errors:

- `ResolverError` — file not found, circular reference, unbound name.
- `ExpanderError` — capture mismatch, conditional on unknown field.
- Both extend `RuntimeError`.

Use `RuntimeErrorCode` to branch on specific failure modes. Each
error has `.loc` (`{ file, line, col }`) for position info.

## Look at the reference renderers

The shortest path to a working custom renderer is reading the two we
ship:

- [`packages/render-html`](../../../render-html) — semantic HTML output, ~600 lines.
- [`packages/render-markdown`](../../../render-markdown) — Markdown output, ~500 lines.

Both have full test suites you can mirror.

## See also

- [`05-scripts-lh-bridge.md`](./05-scripts-lh-bridge.md) — the `<% %>` script bridge runs at render time; your renderer can expose additional `lh` methods.
- [`07-gotchas.md`](./07-gotchas.md) — parser edge cases that affect what your renderer will see in the expanded AST.
