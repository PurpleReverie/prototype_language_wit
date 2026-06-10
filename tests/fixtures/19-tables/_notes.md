# 19-tables fixtures — authoring notes

## `@table` core node (no PLAN.md entry — new I.review item)

The three authoring forms (M10.core-vocab Thread 4):
- `inline-csv.wit` — `|rows [[...], [...]]|` with `|caption ...|`
- `schema-array.wit` — `|schema [k1, k2]| |rows @records|`
- `schema-record.wit` — `|schema { k - Label, ... }| |rows [[...]]|`

Edge cases:
- `no-header.wit` — `|header false|` suppresses the header row
- `empty.wit` — `@table table@` (no params) renders as `<table></table>`
- `multiline-cell.wit` — `!...!` value blocks inside a Collection
  element (Thread 5) for multi-line cells

**Concrete proposal:** the v1 `@table` renderer parses `rows` / `schema` /
`header` / `caption` from raw param text via the parser-data scanner
(`tryParseCollectionFromText` / record split). Themes / CSS handle
number alignment; the renderer does NOT emit `text-align`.
