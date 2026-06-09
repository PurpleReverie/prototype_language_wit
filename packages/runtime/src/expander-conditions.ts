// Condition evaluation helpers used by the expander pass for IfStatement.
//
// An IfStatement carries a Condition (ExistenceCondition or
// ComparisonCondition). The expander, walking a resolved document,
// evaluates the condition against the resolved data (DataDefs map) and
// replaces the IfStatement with its then-branch or else-branch.
//
// Path resolution:
// - A condition's AccessPath segments start with the def name and may
//   continue into record field names. For v1 we do exact (case-sensitive)
//   lookups; fuzzy matching is M4.fuzzy-keys.
//
// Truthiness (per M1-RECONCILIATIONS missing-field rule):
// - Missing field, empty string `""`, the string `"false"`, empty record
//   `{}`, and empty collection `[]` are falsy.
// - Boolean false / number 0 are falsy as well; null is falsy.
// - Anything else is truthy.
//
// Equality (per M1.12 lean):
// - `is` and `equals` are synonyms in v1. Compare the stringified resolved
//   value against the stringified RHS literal. Records / collections
//   stringify to the empty string for now (no structured equality yet).

import type {
  AccessPath,
  Condition,
  ComparisonCondition,
  DataDef,
  DataValue,
  NodeDef,
} from '@wit/parser';
import { lookupRecordField } from './canonical-key.js';

export interface DataLookups {
  dataDefs: Map<string, DataDef>;
  defs: Map<string, NodeDef>;
  // Iteration env: a stack of frames. Item-name lookup checks this
  // BEFORE dataDefs / defs so loop variables mask global data. M4.eval-
  // iteration owns the push/pop. Undefined for non-iteration callers.
  iterEnv?: Map<string, DataValue>[];
}

export function evaluateCondition(
  cond: Condition,
  lookups: DataLookups,
): boolean {
  if (cond.kind === 'existenceCondition') {
    const value = resolveAccessPath(cond.path, lookups);
    return isTruthy(value);
  }
  return evaluateComparison(cond, lookups);
}

function evaluateComparison(
  cond: ComparisonCondition,
  lookups: DataLookups,
): boolean {
  const left = resolveAccessPath(cond.left, lookups);
  const leftStr = stringifyForEquality(left);
  const rightStr = stringifyForEquality(cond.right);
  return leftStr === rightStr;
}

// ---------------------------------------------------------------------------
// Access path resolution.
// ---------------------------------------------------------------------------

export function resolveAccessPath(
  path: AccessPath,
  lookups: DataLookups,
): DataValue | null {
  const segments = path.segments;
  if (segments.length === 0) return null;
  const head = segments[0]!;
  const rest = segments.slice(1);
  const root = resolveRoot(head, lookups);
  if (root === null) return null;
  return walkSegments(root, rest);
}

function resolveRoot(name: string, lookups: DataLookups): DataValue | null {
  const fromIter = lookupIterFrame(lookups.iterEnv, name);
  if (fromIter !== null) return fromIter;
  const dataDef = lookups.dataDefs.get(name);
  if (dataDef !== undefined) return dataDef.value;
  const nodeDef = lookups.defs.get(name);
  if (nodeDef !== undefined) return nodeDefAsDataValue(nodeDef);
  return null;
}

function lookupIterFrame(
  env: Map<string, DataValue>[] | undefined,
  name: string,
): DataValue | null {
  if (env === undefined) return null;
  for (let i = env.length - 1; i >= 0; i--) {
    const found = env[i]!.get(name);
    if (found !== undefined) return found;
  }
  return null;
}

// A NodeDef whose body collapsed to a single Record / Collection literal
// (e.g. `#x: { a - 1 }`) doubles as data. Treat that body as the root
// DataValue for access-path traversal. Otherwise the def has no data face.
function nodeDefAsDataValue(def: NodeDef): DataValue | null {
  if (def.body.length !== 1) return null;
  const only = def.body[0]!;
  if (only.kind === 'record' || only.kind === 'collection') return only;
  return null;
}

function walkSegments(
  value: DataValue,
  segments: readonly string[],
): DataValue | null {
  let current: DataValue = value;
  for (const seg of segments) {
    if (current.kind !== 'record') return null;
    const found = lookupRecordField(current, seg);
    if (found === undefined) return null;
    current = found;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Truthiness + stringification.
// ---------------------------------------------------------------------------

export function isTruthy(value: DataValue | null): boolean {
  if (value === null) return false;
  if (value.kind === 'stringValue') {
    return value.value !== '' && value.value !== 'false';
  }
  if (value.kind === 'numberValue') return value.value !== 0;
  if (value.kind === 'booleanValue') return value.value;
  if (value.kind === 'nullValue') return false;
  if (value.kind === 'record') return value.fields.length > 0;
  if (value.kind === 'collection') return value.items.length > 0;
  return false;
}

export function stringifyForEquality(value: DataValue | null): string {
  if (value === null) return '';
  if (value.kind === 'stringValue') return value.value;
  if (value.kind === 'numberValue') return String(value.value);
  if (value.kind === 'booleanValue') return String(value.value);
  if (value.kind === 'nullValue') return '';
  // Records / collections have no canonical equality form yet; collapse
  // to empty so `@x is something` against a container is never true.
  return '';
}
