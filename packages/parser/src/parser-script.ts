// Script-block + @scriptCall parsing.
//
// parseScriptBlock(cursor, inline)
//   - cursor must point at a `scriptOpen` token. Consumes the
//     ScriptOpen + optional ScriptBlockContent + ScriptClose triple
//     and returns a ScriptBlock AST node.
//   - The `inline` flag is set by the caller based on context:
//       block-level driver  → inline = false
//       inline-level parser → inline = true
//
// parseScriptCall(cursor)
//   - Called by parser-nodes when it sees `@scriptCall(...)`.
//   - Cursor points at the NodeOpen for `scriptCall`. The first arg is
//     a bare-word function identifier (StringValue-like). Additional
//     comma-separated args are captured as raw strings.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import type { ScriptBlock, ScriptCall } from './ast.js';
import type { Loc } from './loc.js';
import type { TokenCursor } from './parser-cursor.js';
import type {
  NodeOpen,
  ScriptBlockContent,
  ScriptClose,
  ScriptOpen,
  Token,
} from './tokens.js';

export function parseScriptBlock(
  cursor: TokenCursor,
  inline: boolean,
): ScriptBlock {
  const open = cursor.advance() as ScriptOpen;
  const content = consumeContent(cursor);
  const close = consumeClose(cursor, open.loc);
  return {
    kind: 'scriptBlock',
    content,
    inline,
    loc: spanLoc(open.loc, close),
  };
}

function consumeContent(cursor: TokenCursor): string {
  const tok = cursor.current();
  if (tok.kind !== 'scriptBlockContent') return '';
  cursor.advance();
  return (tok as ScriptBlockContent).text;
}

function consumeClose(cursor: TokenCursor, fallback: Loc): Loc {
  const tok = cursor.current();
  if (tok.kind === 'scriptClose') {
    cursor.advance();
    return (tok as ScriptClose).loc;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// @scriptCall(...) parsing.
// ---------------------------------------------------------------------------

// Returns true if the cursor sits at `nodeOpen` with name === 'scriptCall'
// followed by `parenOpen` (the call form). Bare `@scriptCall` references
// without parens fall through to the regular NodeUse path.
export function isScriptCallStart(cursor: TokenCursor): boolean {
  const tok = cursor.current();
  if (tok.kind !== 'nodeOpen' || tok.name !== 'scriptCall') return false;
  return cursor.peek(1).kind === 'parenOpen';
}

export function parseScriptCall(cursor: TokenCursor): ScriptCall {
  const open = cursor.advance() as NodeOpen;
  cursor.advance(); // parenOpen
  const args = collectArgs(cursor);
  const closeLoc = consumeParenClose(cursor, open.loc);
  const fnName = args.length > 0 ? args[0] : '';
  return {
    kind: 'scriptCall',
    fnName,
    args: args.slice(1),
    loc: spanLoc(open.loc, closeLoc),
  };
}

function collectArgs(cursor: TokenCursor): string[] {
  const out: string[] = [];
  let buf = '';
  while (!isArgTerminator(cursor.current())) {
    const tok = cursor.current();
    if (tok.kind === 'comma') {
      cursor.advance();
      out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += tokenText(tok);
    cursor.advance();
  }
  if (buf.trim().length > 0) out.push(buf.trim());
  return out;
}

function isArgTerminator(tok: Token): boolean {
  return tok.kind === 'parenClose' ||
         tok.kind === 'eof' ||
         tok.kind === 'paragraphBreak';
}

function tokenText(tok: Token): string {
  if (tok.kind === 'textRun') return tok.value;
  return '';
}

function consumeParenClose(cursor: TokenCursor, fallback: Loc): Loc {
  const tok = cursor.current();
  if (tok.kind === 'parenClose') {
    cursor.advance();
    return tok.loc;
  }
  return fallback;
}

function spanLoc(start: Loc, end: Loc): Loc {
  return {
    file: start.file,
    line: start.line,
    col: start.col,
    offset: start.offset,
    length: end.offset + end.length - start.offset,
  };
}
