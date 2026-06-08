// Token type definitions for the Wit lexer.
// Discriminated union keyed by `kind`. Every token carries a `loc`.
// No runtime code — types only.

import type { HasLoc } from './loc.js';

// ---------------------------------------------------------------------------
// Keyword set (reserved words inside `(...)` statement contexts).
// ---------------------------------------------------------------------------

export type KeywordName =
  | 'if'
  | 'else'
  | 'end'
  | 'each'
  | 'as'
  | 'is'
  | 'equals';

// ---------------------------------------------------------------------------
// Token variants.
// ---------------------------------------------------------------------------

export interface TextRun extends HasLoc {
  kind: 'textRun';
  value: string;
}

export interface ParagraphBreak extends HasLoc {
  kind: 'paragraphBreak';
}

export interface EmphasisOpen extends HasLoc {
  kind: 'emphasisOpen';
  // `_` for italic, `*` for bold.
  marker: '_' | '*';
}

export interface EmphasisClose extends HasLoc {
  kind: 'emphasisClose';
  marker: '_' | '*';
}

export interface LineComment extends HasLoc {
  kind: 'lineComment';
  text: string;
}

export interface BlockCommentOpen extends HasLoc {
  kind: 'blockCommentOpen';
}

export interface BlockCommentClose extends HasLoc {
  kind: 'blockCommentClose';
}

export interface BlockCommentContent extends HasLoc {
  kind: 'blockCommentContent';
  text: string;
}

export interface NodeOpen extends HasLoc {
  // `@name` — start of a node-use.
  kind: 'nodeOpen';
  name: string;
}

export interface NodeClose extends HasLoc {
  // `!name` or bare `!` — close of a named/bare node block.
  kind: 'nodeClose';
  name: string | null;
}

export interface Dot extends HasLoc {
  kind: 'dot';
}

export interface AccessSegment extends HasLoc {
  // A segment of a dotted access path after a NodeOpen, e.g. the `y` in
  // `@x.y`. Segments accept the full handle class plus numeric-only
  // (`.0` valid per M2.lex-nodes brief).
  kind: 'accessSegment';
  name: string;
}

export interface ParenOpen extends HasLoc {
  kind: 'parenOpen';
}

export interface ParenClose extends HasLoc {
  kind: 'parenClose';
}

export interface PipeOpen extends HasLoc {
  kind: 'pipeOpen';
}

export interface PipeClose extends HasLoc {
  kind: 'pipeClose';
}

export interface Comma extends HasLoc {
  kind: 'comma';
}

export interface HyphenSeparator extends HasLoc {
  // `-` separator in node-use access / param syntax.
  kind: 'hyphenSeparator';
}

export interface Bang extends HasLoc {
  kind: 'bang';
}

export interface BangBang extends HasLoc {
  // `!!` — node-definition opener / value-block terminator marker.
  kind: 'bangBang';
}

export interface DoubleBangSlash extends HasLoc {
  // `~~/` — close of a double-bang construct.
  kind: 'doubleBangSlash';
}

export interface CaptureOpen extends HasLoc {
  // `||` opening capture list.
  kind: 'captureOpen';
}

export interface CaptureClose extends HasLoc {
  // `||` closing capture list.
  kind: 'captureClose';
}

export interface InterpolationOpen extends HasLoc {
  // `::` opening an interpolation.
  kind: 'interpolationOpen';
}

export interface InterpolationClose extends HasLoc {
  // `::` closing an interpolation.
  kind: 'interpolationClose';
}

export interface BodySlotMarker extends HasLoc {
  // `...` body slot in a node definition.
  kind: 'bodySlotMarker';
}

export interface ParenStatementOpen extends HasLoc {
  // `(` that introduces a statement (vs. a param-list).
  kind: 'parenStatementOpen';
}

export interface Keyword extends HasLoc {
  kind: 'keyword';
  name: KeywordName;
}

export interface ScriptOpen extends HasLoc {
  kind: 'scriptOpen';
}

export interface ScriptClose extends HasLoc {
  kind: 'scriptClose';
}

export interface HashOpen extends HasLoc {
  kind: 'hashOpen';
}

export interface HashClose extends HasLoc {
  kind: 'hashClose';
}

export interface AdditivePrefix extends HasLoc {
  // `+` prefix on additive node definitions.
  kind: 'additivePrefix';
}

export interface RecordOpen extends HasLoc {
  kind: 'recordOpen';
}

export interface RecordClose extends HasLoc {
  kind: 'recordClose';
}

export interface CollectionOpen extends HasLoc {
  kind: 'collectionOpen';
}

export interface CollectionClose extends HasLoc {
  kind: 'collectionClose';
}

export interface ValueBlockTerminator extends HasLoc {
  // `!!` in a value-block close position.
  kind: 'valueBlockTerminator';
}

export interface EOF extends HasLoc {
  kind: 'eof';
}

// ---------------------------------------------------------------------------
// Token union.
// ---------------------------------------------------------------------------

export type Token =
  | TextRun
  | ParagraphBreak
  | EmphasisOpen
  | EmphasisClose
  | LineComment
  | BlockCommentOpen
  | BlockCommentClose
  | BlockCommentContent
  | NodeOpen
  | NodeClose
  | Dot
  | AccessSegment
  | ParenOpen
  | ParenClose
  | PipeOpen
  | PipeClose
  | Comma
  | HyphenSeparator
  | Bang
  | BangBang
  | DoubleBangSlash
  | CaptureOpen
  | CaptureClose
  | InterpolationOpen
  | InterpolationClose
  | BodySlotMarker
  | ParenStatementOpen
  | Keyword
  | ScriptOpen
  | ScriptClose
  | HashOpen
  | HashClose
  | AdditivePrefix
  | RecordOpen
  | RecordClose
  | CollectionOpen
  | CollectionClose
  | ValueBlockTerminator
  | EOF;

export type TokenKind = Token['kind'];
