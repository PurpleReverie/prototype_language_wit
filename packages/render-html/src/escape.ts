// HTML escape helpers used by the renderer.
//
// `escapeHtml` escapes the five characters that are unsafe in PCDATA or
// attribute contexts: `&`, `<`, `>`, `"`, `'`. This is the minimum set
// required to be safe in both element bodies and double-quoted attribute
// values. Single quotes are escaped (as `&#39;`) so the helper is also
// safe inside single-quoted attribute values; renderers in this package
// always use double-quoted attributes, but the extra cost is negligible
// and removes a foot-gun for callers reusing the helper.

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const PATTERN = /[&<>"']/g;

export function escapeHtml(input: string): string {
  return input.replace(PATTERN, (ch) => ENTITIES[ch] ?? ch);
}
