// Source-location types shared between AST nodes and tokens.

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
  offset: number;
  length: number;
}

// Shorthand alias for nodes/tokens that always carry a location.
export type Loc = SourceLocation;

// Mixin shape: every AST node and token includes `loc`.
export interface HasLoc {
  loc: Loc;
}
