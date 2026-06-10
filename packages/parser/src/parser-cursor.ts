// TokenCursor: read-only walker over a Token[] stream produced by the
// lexer. Provides index, peek, advance, expect helpers used by the
// recursive-descent parser driver.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import type { Token, TokenKind } from './tokens.js';

export class TokenCursor {
  private readonly tokens: Token[];
  private readonly src: string;
  private idx: number;

  constructor(tokens: Token[], source: string = '') {
    if (tokens.length === 0) {
      throw new Error('TokenCursor requires at least one token (EOF).');
    }
    this.tokens = tokens;
    this.src = source;
    this.idx = 0;
  }

  // Raw source text (for form-fill detection and similar shape-on-text checks
  // that need the original byte sequence, not the post-lex token stream).
  source(): string {
    return this.src;
  }

  // Substring of the original source between two absolute byte offsets.
  sliceSource(start: number, end: number): string {
    return this.src.slice(start, end);
  }

  // Current token (without advancing).
  current(): Token {
    return this.tokens[this.lastIndex()];
  }

  // Token `ahead` positions past current; clamped at EOF.
  peek(ahead: number = 0): Token {
    const want = this.idx + ahead;
    if (want >= this.tokens.length) return this.tokens[this.lastIndex()];
    return this.tokens[want];
  }

  // Whether the cursor has reached the EOF token.
  isAtEnd(): boolean {
    return this.current().kind === 'eof';
  }

  // Index getter for diagnostics / tests.
  position(): number {
    return this.idx;
  }

  // Restore a previously-captured position. Used by speculative
  // recognizers (e.g. emphasis pairing) that need to roll back on
  // mismatch.
  reset(idx: number): void {
    if (idx < 0 || idx >= this.tokens.length) {
      throw new Error(`TokenCursor.reset: index ${idx} out of range.`);
    }
    this.idx = idx;
  }

  // Advance one step (never past EOF) and return the *previous* token.
  advance(): Token {
    const tok = this.current();
    if (tok.kind !== 'eof') this.idx += 1;
    return tok;
  }

  // Consume current if its kind matches; otherwise return null.
  match(kind: TokenKind): Token | null {
    if (this.current().kind !== kind) return null;
    return this.advance();
  }

  // Consume current if predicate holds; otherwise return null.
  matchWhere(pred: (t: Token) => boolean): Token | null {
    if (!pred(this.current())) return null;
    return this.advance();
  }

  private lastIndex(): number {
    return Math.min(this.idx, this.tokens.length - 1);
  }
}
