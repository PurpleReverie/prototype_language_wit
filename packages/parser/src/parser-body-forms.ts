// M15.form-fill-and-colon-params: body post-processing helpers.
//
// Runs after a NodeUse / NodeDef body is collected and decides whether
// the body shape is:
//   (a) form-fill — every non-blank, non-comment line is `<key>:<value>`.
//       The body becomes a record-like param bag (ParamSource='form-fill'
//       for NodeUse, or the def's value collapses to a Record for NodeDef).
//   (b) prose-with-scatter — text is plain prose; sweep for `<id>:<v>`
//       tokens following the strict contract (zero whitespace) and lift
//       them as scattered params (ParamSource='pipes', last-wins).
//
// Quoted-string values `"..."` are recognized in both shapes. Backslash
// escapes (`\:` `\"` `\\` `\{` `\}`) are stripped after the scatter sweep
// so the author can opt out of the colon contract with `name\:Tauraj`.
//
// Functions ≤ 20 lines (RULES 2). File ≤ 350 lines (RULES 1).

import { ErrorCode } from './errors.js';
import { ParseError } from './parser-errors.js';
import { probeParamValue } from './parser-data.js';
import type {
  Block,
  Comment,
  Inline,
  Param,
  Record as RecordNode,
  Text,
} from './ast.js';
import type { Loc } from './loc.js';

export { liftBodyScatter } from './parser-body-scatter.js';
export type { BodyScatterResult } from './parser-body-scatter.js';

// ---------------------------------------------------------------------------
// Form-fill detection.
// ---------------------------------------------------------------------------

// Returns true when the body is a form-fill: at least two lines, first
// non-blank non-comment line matches `^\s*<id>\s*:`.
export function isFormFillBody(body: readonly (Block | Inline)[]): boolean {
  const text = bodyToText(body);
  return isFormFillRawText(text);
}

// Raw-text form-fill shape check. M15 form-fill bodies bypass the inline
// parser to preserve emphasis markers (`_text_`, `*term*`) as literal
// characters inside field values. Detection runs on the unparsed body
// substring (between the opener and the matching closer).
//
// Form-fill requires at least TWO non-blank non-comment lines, and the
// first such line must look like `<id>:`. A single content line wrapped
// in blank lines stays a prose body — that's the `@x k:v x@` rule
// extended to raw spans like `\nFrom ::source::: ::body::.\n`.
export function isFormFillRawText(text: string): boolean {
  if (!text.includes('\n')) return false; // single-line bodies fall through
  const lines = text.split('\n');
  let contentSeen = 0;
  let firstLooksLikeField = false;
  for (const line of lines) {
    if (isBlankOrComment(line)) continue;
    if (contentSeen === 0) {
      firstLooksLikeField = /^\s*[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line);
    }
    contentSeen += 1;
    if (contentSeen >= 2) break;
  }
  return contentSeen >= 2 && firstLooksLikeField;
}

function isBlankOrComment(line: string): boolean {
  if (/^\s*$/.test(line)) return true;
  if (/^\s*~/.test(line)) return true;
  return false;
}

// Convert a body's prose-only text content to a single string. Inline
// nodes that aren't pure text become opaque placeholders (we only care
// about the line structure for form-fill detection).
function bodyToText(body: readonly (Block | Inline)[]): string {
  const parts: string[] = [];
  for (const node of body) collectText(node, parts);
  return parts.join('');
}

function collectText(node: Block | Inline, parts: string[]): void {
  const kind = (node as { kind: string }).kind;
  if (kind === 'text') { parts.push((node as Text).value); return; }
  if (kind === 'paragraph') {
    for (const c of (node as { children: Inline[] }).children) collectText(c, parts);
    return;
  }
  if (kind === 'comment') return; // comments are skipped for shape detection
  parts.push(''); // placeholder for non-text inline (NodeUse, etc.)
}

// ---------------------------------------------------------------------------
// Form-fill parse.
// ---------------------------------------------------------------------------

// Parse a form-fill body string into a list of (key, value) fields.
// Throws E_MALFORMED_FORM_FIELD on a line that isn't a comment, blank, or
// `<id>:<value>` shape. Operates on raw source text (M15 fix): bodies
// reaching form-fill bypass the inline parser so emphasis markers such as
// `_journal_` and `*term*` survive as literal characters in field values.
//
// M16: a `key:` with empty same-line value followed by deeper-indented
// lines consumes the indented block as the value (see takeIndentedBlock).
export function parseFormFillFields(
  rawText: string,
  loc: Loc,
): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  const lines = rawText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (isBlankOrComment(line)) { i += 1; continue; }
    const m = /^(\s*)([A-Za-z][A-Za-z0-9_-]*)\s*:(.*)$/.exec(line);
    if (m === null) {
      throw new ParseError(
        ErrorCode.E_MALFORMED_FORM_FIELD,
        `form-fill body line is not <key>:<value>: ${line.trim()}`,
        loc,
      );
    }
    const indent = m[1]!;
    const rest = m[3]!;
    if (rest.trim().length > 0) {
      fields.push({ key: m[2]!, value: parseFieldValueText(rest) });
      i += 1; continue;
    }
    const block = takeIndentedBlock(lines, i + 1, indent, () => false);
    fields.push({ key: m[2]!, value: block.value });
    i = block.nextIndex;
  }
  return fields;
}

// M16.multi-line-param-values: indented-continuation helper.
//
// Given the line array, the index of the first candidate continuation
// line, and the key line's leading whitespace prefix, consume lines whose
// leading whitespace starts with the prefix AND has at least one
// additional character. Stop at a line at ≤ key indent OR when the
// optional `stop` predicate returns true on a content line. Each kept
// line has the outer prefix stripped; inner indent is preserved. Blank
// lines inside the block are kept verbatim; trailing blank lines on the
// joined value are stripped.
export function takeIndentedBlock(
  lines: string[],
  startIndex: number,
  keyIndent: string,
  stop: (line: string) => boolean,
): { value: string; nextIndex: number } {
  // Find the first non-blank candidate; it sets whether a block exists.
  let scan = startIndex;
  while (scan < lines.length && /^\s*$/.test(lines[scan]!)) scan += 1;
  if (scan >= lines.length) return { value: '', nextIndex: startIndex };
  const first = lines[scan]!;
  if (!isStrictlyDeeperIndent(first, keyIndent)) {
    return { value: '', nextIndex: startIndex };
  }
  if (stop(first)) return { value: '', nextIndex: startIndex };
  // Found a deeper-indented continuation — include any leading blank
  // lines between the key line and this point as part of the value.
  const collected: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const ln = lines[i]!;
    if (/^\s*$/.test(ln)) { collected.push(''); i += 1; continue; }
    if (!isStrictlyDeeperIndent(ln, keyIndent)) break;
    if (stop(ln)) break;
    collected.push(ln.slice(keyIndent.length).replace(/[ \t]+$/, ''));
    i += 1;
  }
  while (collected.length > 0 && collected[collected.length - 1] === '') {
    collected.pop();
  }
  return { value: collected.join('\n'), nextIndex: i };
}

function isStrictlyDeeperIndent(line: string, keyIndent: string): boolean {
  if (!line.startsWith(keyIndent)) return false;
  const next = line.charAt(keyIndent.length);
  return next === ' ' || next === '\t';
}

function parseFieldValueText(raw: string): string {
  // One optional leading space is consumed (matches the `key: value`
  // idiom); trailing whitespace stripped. If the resulting value is
  // exactly `"..."`, surrounding quotes are stripped and `\"` / `\\`
  // inside are unescaped (mirrors pipe-form value-unquote). Otherwise
  // the value is kept as-is, with the four backslash escapes recognized
  // for opt-out characters (`\:` `\"` `\\`; `\_` / `\*` etc. pass
  // through literally because inline parsing isn't happening).
  let v = raw.replace(/[ \t]+$/, '');
  if (v.startsWith(' ')) v = v.slice(1);
  const quoted = tryUnquote(v);
  if (quoted !== null) return quoted;
  return stripFormFillEscapes(v);
}

// Form-fill values recognize `\"`, `\\`, `\:`, and `\,` escapes; other
// backslash sequences pass through literally (so `\_`, `\*` survive as
// `\_`, `\*` because inline parsing doesn't run on the value).
//
// W-20: `\,` is the documented author-side opt-out so a literal comma
// inside a `[ a, b, c ]` collection-shaped value can be safely captured
// without splitting items. The backslash is dropped here so the comma
// reaches the rendered output as a plain `,`.
function stripFormFillEscapes(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === '\\' && i + 1 < s.length) {
      const next = s.charAt(i + 1);
      if (next === ':' || next === '"' || next === '\\' || next === ',') {
        out += next; i += 1; continue;
      }
    }
    out += c;
  }
  return out;
}

function tryUnquote(s: string): string | null {
  if (s.length < 2 || s.charAt(0) !== '"' || s.charAt(s.length - 1) !== '"') {
    return null;
  }
  let out = '';
  let i = 1;
  while (i < s.length - 1) {
    const c = s.charAt(i);
    if (c === '\\' && i + 1 < s.length - 1) {
      const n = s.charAt(i + 1);
      if (n === '"' || n === '\\') { out += n; i += 2; continue; }
    }
    out += c;
    i += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Backslash escape stripping (post-pass for prose text).
// ---------------------------------------------------------------------------

export function stripEscapes(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    if (c === '\\' && i + 1 < s.length) {
      const next = s.charAt(i + 1);
      // W-20: include `,` so `\,` inside prose-shape captured values
      // (e.g. a quoted bareword in `key value\, more`) reaches the
      // renderer as a plain comma rather than a literal backslash.
      if (next === ':' || next === '"' || next === '\\' ||
          next === '{' || next === '}' || next === ',') {
        out += next; i += 1; continue;
      }
    }
    out += c;
  }
  return out;
}

// Convenience: walk a body and strip escapes from every Text node.
export function stripBodyEscapes(
  body: readonly (Block | Inline)[],
): (Block | Inline)[] {
  return body.map((n) => stripEscapesInNode(n));
}

function stripEscapesInNode(node: Block | Inline): Block | Inline {
  if (node.kind === 'text') return { ...node, value: stripEscapes(node.value) };
  if (node.kind === 'paragraph') {
    return { ...node, children: node.children.map(
      (c) => stripEscapesInNode(c) as Inline) };
  }
  if (node.kind === 'italic' || node.kind === 'bold') {
    return { ...node, children: node.children.map(
      (c) => stripEscapesInNode(c) as Inline) };
  }
  return node;
}

// ---------------------------------------------------------------------------
// Form-fill → Record (for NodeDef body shape).
// ---------------------------------------------------------------------------

export function formFillToRecord(
  rawText: string,
  loc: Loc,
): RecordNode {
  const fields = parseFormFillFields(rawText, loc);
  return {
    kind: 'record',
    fields: fields.map((f) => ({
      key: f.key,
      value: {
        kind: 'stringValue',
        value: f.value,
        loc: structuredClone(loc),
      },
    })),
    loc: structuredClone(loc),
  };
}

// Form-fill → Param[] (for NodeUse).
export function formFillToParams(
  rawText: string,
  loc: Loc,
): Param[] {
  const fields = parseFormFillFields(rawText, loc);
  return fields.map((f) => {
    const pLoc = structuredClone(loc);
    const param: Param = { name: f.key, value: f.value, loc: pLoc };
    const probed = probeParamValue(f.value, pLoc);
    if (probed !== null) param.typedValue = probed;
    return param;
  });
}

// Silence unused-symbol warnings for types used only in JSDoc.
export type _Unused = Comment;
