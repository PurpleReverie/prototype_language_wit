// Cross-file resolution helpers (M4.cross-file).
//
// `resolveCrossFile` walks a Document's ReferenceDirective entries,
// reads each referenced file via the supplied FileReader, parses it,
// recursively resolves it, and merges its definitions into the current
// file's tables. Cycle detection uses absolute paths.
//
// Errors thrown here:
// - E_MISSING_REFERENCE_FILE — file not found / unreadable.
// - E_CIRCULAR_REFERENCE — same path reached while still resolving.
// - E_DUPLICATE_DEFINITION — non-additive name collision between files.

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve as resolvePath } from 'node:path';

import type {
  Block,
  Document,
  NodeDef,
  DataDef,
  ReferenceDirective,
} from '@witlang/parser';
import { parse } from '@witlang/parser';

import type { ResolvedDocument } from './resolved-ast.js';
import { ResolverError, RuntimeErrorCode } from './errors.js';

export type FileReader = (absPath: string) => string;

export interface FileCtx {
  reader: FileReader;
  resolving: Set<string>;
  resolved: Map<string, ResolvedDocument>;
  // Bound by the caller to avoid a cycle in module deps.
  resolveDocument: (
    doc: Document,
    fileCtx: FileCtx,
    rootPath: string,
  ) => ResolvedDocument;
  // W-10: when set, swallow E_MISSING_REFERENCE_FILE and skip the
  // referenced merge instead of throwing.
  onMissingReference?: (path: string) => null | void;
}

export function defaultFileReader(absPath: string): string {
  try {
    return readFileSync(absPath, 'utf8');
  } catch {
    throw new MissingFile(absPath);
  }
}

class MissingFile extends Error {
  constructor(public readonly path: string) {
    super(`missing file ${path}`);
  }
}

export function computeAbsPath(rootPath: string, refPath: string): string {
  if (isAbsolute(refPath)) return refPath;
  return resolvePath(dirname(rootPath), refPath);
}

// Walks the doc's ReferenceDirective entries and merges each referenced
// file's resolved tables into the supplied targets. Mutates `targets`.
export function mergeReferences(
  doc: Document,
  rootPath: string,
  ctx: FileCtx,
  targets: MergeTargets,
): void {
  for (const directive of collectReferences(doc.children)) {
    const absPath = computeAbsPath(rootPath, directive.path);
    let refDoc: ResolvedDocument;
    try {
      refDoc = loadReferenced(absPath, directive, ctx);
    } catch (err) {
      // W-10: optional-reference callback can swallow the missing-file
      // error and skip this directive. Any other resolver error
      // (circular, duplicate, etc.) still propagates.
      if (err instanceof ResolverError &&
          err.code === RuntimeErrorCode.E_MISSING_REFERENCE_FILE &&
          ctx.onMissingReference !== undefined) {
        ctx.onMissingReference(absPath);
        continue;
      }
      throw err;
    }
    mergeInto(refDoc, targets, directive);
    targets.resolvedFiles.set(absPath, refDoc);
    for (const [p, r] of refDoc.resolvedFiles) {
      if (!targets.resolvedFiles.has(p)) targets.resolvedFiles.set(p, r);
    }
  }
}

export interface MergeTargets {
  definitions: Map<string, NodeDef>;
  dataDefs: Map<string, DataDef>;
  partials: Map<string, NodeDef[]>;
  resolvedFiles: Map<string, ResolvedDocument>;
}

function loadReferenced(
  absPath: string,
  directive: ReferenceDirective,
  ctx: FileCtx,
): ResolvedDocument {
  const cached = ctx.resolved.get(absPath);
  if (cached !== undefined) return cached;
  if (ctx.resolving.has(absPath)) {
    throw new ResolverError(
      RuntimeErrorCode.E_CIRCULAR_REFERENCE,
      `Circular reference to ${absPath}`,
      directive.loc,
    );
  }
  const source = readSource(absPath, directive, ctx.reader);
  return resolveChild(absPath, source, ctx);
}

function resolveChild(
  absPath: string,
  source: string,
  ctx: FileCtx,
): ResolvedDocument {
  ctx.resolving.add(absPath);
  try {
    const childDoc = parse(source, absPath);
    const resolvedChild = ctx.resolveDocument(childDoc, ctx, absPath);
    ctx.resolved.set(absPath, resolvedChild);
    return resolvedChild;
  } finally {
    ctx.resolving.delete(absPath);
  }
}

function readSource(
  absPath: string,
  directive: ReferenceDirective,
  reader: FileReader,
): string {
  try {
    return reader(absPath);
  } catch (err) {
    const path = err instanceof MissingFile ? err.path : absPath;
    throw new ResolverError(
      RuntimeErrorCode.E_MISSING_REFERENCE_FILE,
      `Referenced file not found: ${path}`,
      directive.loc,
    );
  }
}

function mergeInto(
  refDoc: ResolvedDocument,
  targets: MergeTargets,
  directive: ReferenceDirective,
): void {
  mergeNodeDefs(refDoc.definitions, targets, directive);
  mergeDataDefs(refDoc.dataDefs, targets.dataDefs, directive);
  mergePartials(refDoc.partials, targets.partials);
}

function mergeNodeDefs(
  src: Map<string, NodeDef>,
  targets: MergeTargets,
  directive: ReferenceDirective,
): void {
  for (const [name, def] of src) {
    const prior = targets.definitions.get(name);
    if (prior === def) continue; // diamond: same shared file, skip.
    if (def.additive) {
      pushPartial(targets.partials, name, def);
      continue;
    }
    rejectIfDuplicate(prior, name, directive);
    targets.definitions.set(name, def);
  }
}

// Additive defs from a child file flow into the parent's partial list;
// the parent re-merges them via mergePartials after collectDefs runs.
function pushPartial(
  partials: Map<string, NodeDef[]>,
  name: string,
  def: NodeDef,
): void {
  const acc = partials.get(name) ?? [];
  if (!acc.includes(def)) acc.push(def);
  partials.set(name, acc);
}

function rejectIfDuplicate(
  prior: NodeDef | undefined,
  name: string,
  directive: ReferenceDirective,
): void {
  if (prior === undefined || prior.additive) return;
  throw new ResolverError(
    RuntimeErrorCode.E_DUPLICATE_DEFINITION,
    `Duplicate definition #${name} (merged from ${directive.path})`,
    directive.loc,
  );
}

function mergeDataDefs(
  src: Map<string, DataDef>,
  dst: Map<string, DataDef>,
  directive: ReferenceDirective,
): void {
  for (const [name, def] of src) {
    const prior = dst.get(name);
    if (prior === def) continue;
    if (prior !== undefined) {
      throw new ResolverError(
        RuntimeErrorCode.E_DUPLICATE_DEFINITION,
        `Duplicate data definition #${name} (merged from ${directive.path})`,
        directive.loc,
      );
    }
    dst.set(name, def);
  }
}

function mergePartials(
  src: Map<string, NodeDef[]>,
  dst: Map<string, NodeDef[]>,
): void {
  for (const [name, list] of src) {
    const acc = dst.get(name) ?? [];
    for (const def of list) {
      if (!acc.includes(def)) acc.push(def);
    }
    dst.set(name, acc);
  }
}

export function collectReferences(
  blocks: readonly Block[],
): ReferenceDirective[] {
  const out: ReferenceDirective[] = [];
  for (const block of blocks) {
    if (block.kind === 'reference') out.push(block);
  }
  return out;
}
