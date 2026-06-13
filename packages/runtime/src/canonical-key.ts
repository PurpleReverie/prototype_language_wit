// Canonical key matching for record field access (M4.fuzzy-keys).
//
// Record fields named `years at post` should be accessible as
// `@x.years_at_post`, `@x.yearsAtPost`, `@x.years at post`, etc. All
// forms collapse to a single canonical key for lookup.
//
// Canonicalization (per M1.11 lean):
//   - Lowercase the segment.
//   - Strip every non-alphanumeric character. Spaces, hyphens, and
//     underscores all drop. CamelCase boundaries collapse (since we
//     only lowercase; the casing carries no segmenter).
//   - Result: `[a-z0-9]*`.
//
// Index build:
//   - Given a Record, build Map<canonicalKey, fieldValue>. Cached on a
//     WeakMap so the same Record instance pays the cost once.
//   - If two field keys collapse to the same canonical key, the Record
//     is ambiguous → E_AMBIGUOUS_RECORD_KEY at index-build time.

import type { DataValue, Record as RecordNode } from '@witlang/parser';
import { ResolverError, RuntimeErrorCode } from './errors.js';

export function canonicalizeKey(segment: string): string {
  let out = '';
  for (const ch of segment.toLowerCase()) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) out += ch;
  }
  return out;
}

const indexCache = new WeakMap<RecordNode, Map<string, DataValue>>();

export function getRecordIndex(record: RecordNode): Map<string, DataValue> {
  const cached = indexCache.get(record);
  if (cached !== undefined) return cached;
  const built = buildRecordIndex(record);
  indexCache.set(record, built);
  return built;
}

function buildRecordIndex(record: RecordNode): Map<string, DataValue> {
  const index = new Map<string, DataValue>();
  const seen = new Map<string, string>();
  for (const field of record.fields) {
    const canon = canonicalizeKey(field.key);
    const prior = seen.get(canon);
    if (prior !== undefined) throwAmbiguous(record, prior, field.key, canon);
    seen.set(canon, field.key);
    index.set(canon, field.value);
  }
  return index;
}

function throwAmbiguous(
  record: RecordNode,
  priorKey: string,
  duplicateKey: string,
  canon: string,
): never {
  throw new ResolverError(
    RuntimeErrorCode.E_AMBIGUOUS_RECORD_KEY,
    `Record fields "${priorKey}" and "${duplicateKey}" both canonicalize to "${canon}"`,
    record.loc,
  );
}

export function lookupRecordField(
  record: RecordNode,
  accessSegment: string,
): DataValue | undefined {
  const index = getRecordIndex(record);
  return index.get(canonicalizeKey(accessSegment));
}
