// AST node type definitions for Wit.
// Discriminated unions keyed by `kind`. Every node carries a `loc`.
// No runtime code — types only.

import type { HasLoc } from './loc.js';

// ---------------------------------------------------------------------------
// Parameter / access-path helpers (referenced by node-use and statements).
// ---------------------------------------------------------------------------

export interface Param extends HasLoc {
  // A node-use parameter. `name` is null for positional values.
  name: string | null;
  value: string;
}

export interface AccessPath extends HasLoc {
  // Dotted access like `foo.bar.baz`.
  segments: string[];
}

// ---------------------------------------------------------------------------
// Data values (used by data-defs, records, collections).
// ---------------------------------------------------------------------------

export interface StringValue extends HasLoc {
  kind: 'stringValue';
  value: string;
}

export interface NumberValue extends HasLoc {
  kind: 'numberValue';
  value: number;
}

export interface BooleanValue extends HasLoc {
  kind: 'booleanValue';
  value: boolean;
}

export interface NullValue extends HasLoc {
  kind: 'nullValue';
}

export type DataValue =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | Record
  | Collection;

// ---------------------------------------------------------------------------
// Conditions for `if` statements.
// ---------------------------------------------------------------------------

export interface ExistenceCondition extends HasLoc {
  kind: 'existenceCondition';
  path: AccessPath;
}

export interface ComparisonCondition extends HasLoc {
  kind: 'comparisonCondition';
  left: AccessPath;
  op: 'is' | 'equals';
  right: DataValue;
}

export type Condition = ExistenceCondition | ComparisonCondition;

// ---------------------------------------------------------------------------
// Inline-level nodes.
// ---------------------------------------------------------------------------

export interface Text extends HasLoc {
  kind: 'text';
  value: string;
}

export interface Italic extends HasLoc {
  kind: 'italic';
  children: Inline[];
}

export interface Bold extends HasLoc {
  kind: 'bold';
  children: Inline[];
}

export interface Interpolation extends HasLoc {
  kind: 'interpolation';
  name: string;
}

export interface BodySlot extends HasLoc {
  kind: 'bodySlot';
}

// ---------------------------------------------------------------------------
// Block-level nodes.
// ---------------------------------------------------------------------------

export interface Document extends HasLoc {
  kind: 'document';
  children: Block[];
}

export interface Paragraph extends HasLoc {
  kind: 'paragraph';
  children: Inline[];
}

export interface Comment extends HasLoc {
  kind: 'comment';
  text: string;
  inline: boolean;
}

export interface NodeUse extends HasLoc {
  kind: 'nodeUse';
  name: string;
  access?: string[];
  params: Param[];
  paramsSource: 'parens' | 'pipes' | 'mixed' | 'none';
  body: (Block | Inline)[] | null;
  inline: boolean;
  closeStyle: 'named' | 'parens' | 'bare';
}

export interface NodeDef extends HasLoc {
  kind: 'nodeDef';
  name: string;
  captures: string[];
  shape: 'block' | 'single-line' | 'value-block';
  // Body is normally a list of Block/Inline children, but a single-line
  // def whose entire value is a record literal collapses to `[Record]`
  // (M3.records).
  body: (Block | Inline | Record)[];
  additive: boolean;
}

export interface DataDef extends HasLoc {
  kind: 'dataDef';
  name: string;
  value: DataValue;
}

export interface Record extends HasLoc {
  kind: 'record';
  fields: { key: string; value: DataValue }[];
}

export interface Collection extends HasLoc {
  kind: 'collection';
  items: DataValue[];
}

export interface ReferenceDirective extends HasLoc {
  kind: 'reference';
  path: string;
}

export interface IfStatement extends HasLoc {
  kind: 'ifStatement';
  cond: Condition;
  then: Block[];
  else?: Block[];
}

export interface EachStatement extends HasLoc {
  kind: 'eachStatement';
  collection: AccessPath;
  itemName: string;
  body: Block[];
}

export interface ScriptBlock extends HasLoc {
  kind: 'scriptBlock';
  content: string;
  inline: boolean;
}

export interface ScriptCall extends HasLoc {
  kind: 'scriptCall';
  fnName: string;
  args: string[];
}

// ---------------------------------------------------------------------------
// Union types: Inline / Block / AstNode.
// ---------------------------------------------------------------------------

export type Inline =
  | Text
  | Italic
  | Bold
  | Interpolation
  | BodySlot
  | NodeUse
  | ScriptCall
  | Comment;

export type Block =
  | Paragraph
  | Comment
  | NodeUse
  | NodeDef
  | DataDef
  | ReferenceDirective
  | IfStatement
  | EachStatement
  | ScriptBlock;

export type AstNode =
  | Document
  | Block
  | Inline
  | DataValue
  | Condition
  | Param
  | AccessPath;
