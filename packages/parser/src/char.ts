// Character classification helpers for the Wit lexer.
// All predicates accept a single-character string. Empty strings return false.
// I.36: handle class is ASCII-only `[A-Za-z0-9_-]` for v1.0.

export function isAsciiLetter(c: string): boolean {
  if (c.length !== 1) return false;
  const code = c.charCodeAt(0);
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
}

export function isAsciiDigit(c: string): boolean {
  if (c.length !== 1) return false;
  const code = c.charCodeAt(0);
  return code >= 0x30 && code <= 0x39;
}

export function isHandleChar(c: string): boolean {
  // I.36: ASCII letters, digits, underscore, hyphen.
  if (c.length !== 1) return false;
  return isAsciiLetter(c) || isAsciiDigit(c) || c === '_' || c === '-';
}

export function isWordChar(c: string): boolean {
  // Word continuation: handle chars plus ASCII apostrophe-ish nothing extra.
  // Kept ASCII-only for v1.0 alignment with I.36; recognizers may broaden.
  return isHandleChar(c);
}

export function isLineTerminator(c: string): boolean {
  // After CRLF/CR normalization only `\n` remains, but we keep CR for the
  // normalization pre-pass to detect bare-CR explicitly if needed later.
  return c === '\n' || c === '\r';
}

export function isWhitespace(c: string): boolean {
  // Space and tab only — line terminators tracked separately.
  return c === ' ' || c === '\t';
}
