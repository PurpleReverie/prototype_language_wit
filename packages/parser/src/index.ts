// Curated public surface for @wit/parser (v0.1.0).
//
// Anything not re-exported here is package-private. Downstream consumers
// (runtime, renderers, CLI, language server) import from this module
// only; internal modules use relative paths between each other.

// Top-level entry point.
export { parse } from './parser.js';

// AST types — only the kinds and helpers consumers actually need.
export type {
  // Top-level shape
  Document,
  Block,
  Inline,
  AstNode,
  // Block-level
  Paragraph,
  Comment,
  NodeUse,
  NodeDef,
  DataDef,
  Record,
  Collection,
  IfStatement,
  EachStatement,
  ScriptBlock,
  ScriptCall,
  ReferenceDirective,
  // Inline-level
  Text,
  Italic,
  Bold,
  Interpolation,
  BodySlot,
  // Data values
  DataValue,
  StringValue,
  NumberValue,
  BooleanValue,
  NullValue,
  // Conditions
  Condition,
  ExistenceCondition,
  ComparisonCondition,
  // Helpers
  Param,
  AccessPath,
} from './ast.js';

// Location + error types — needed for any consumer that wants to report
// positions or handle parse failures.
export type { Loc, HasLoc } from './loc.js';
export { WitError } from './errors.js';

// Inline parser entry — exposed because the runtime expander uses it
// to re-parse captured raw values at substitution time.
export { parseInlineFromText } from './parser-inline.js';

// Data scanners — used by the runtime to parse late-bound record/collection
// text values (e.g., from form-fill captures).
export {
  tryParseRecordFromText,
  tryParseCollectionFromText,
} from './parser-data.js';
