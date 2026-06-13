// Per-URI document state cache. Holds the parse/resolve/position-index
// triple plus error lists. Cross-file dependents tracked separately in
// cross-file.ts so cache stays focused on individual document state.

import { parse, WitError, type Document } from '@witlang/parser';
import { resolve, ResolverError, type ResolvedDocument } from '@witlang/runtime';
import {
  buildPositionIndex,
  type PositionEntry,
} from './position-index.js';
import { makeFileReader, fsPathFromUri, uriFromFsPath } from './cross-file.js';

export interface DocumentState {
  uri: string;
  source: string;
  parsed: Document | null;
  resolved: ResolvedDocument | null;
  parseErrors: WitError[];
  resolveErrors: (WitError | ResolverError)[];
  positionIndex: PositionEntry[];
  // Absolute fs path of files referenced (directly or transitively).
  referencedPaths: string[];
}

export class DocumentCache {
  private states = new Map<string, DocumentState>();
  private overlay = new Map<string, string>(); // uri → live in-memory text

  setOverlay(uri: string, text: string): void {
    const fsPath = fsPathFromUri(uri);
    if (fsPath) this.overlay.set(fsPath, text);
  }

  removeOverlay(uri: string): void {
    const fsPath = fsPathFromUri(uri);
    if (fsPath) this.overlay.delete(fsPath);
  }

  update(uri: string, source: string): DocumentState {
    const state = this.computeState(uri, source);
    this.states.set(uri, state);
    return state;
  }

  get(uri: string): DocumentState | undefined {
    return this.states.get(uri);
  }

  // Lookup any cached document whose absolute fs path matches.
  findByPath(absPath: string): DocumentState | undefined {
    const targetUri = uriFromFsPath(absPath);
    return this.states.get(targetUri);
  }

  clear(uri: string): void {
    this.states.delete(uri);
  }

  private computeState(uri: string, source: string): DocumentState {
    const state: DocumentState = {
      uri,
      source,
      parsed: null,
      resolved: null,
      parseErrors: [],
      resolveErrors: [],
      positionIndex: [],
      referencedPaths: [],
    };
    parseInto(state, uri, source);
    if (state.parsed) resolveInto(state, uri, this.overlay);
    return state;
  }
}

function parseInto(state: DocumentState, uri: string, source: string): void {
  try {
    state.parsed = parse(source, uri);
  } catch (err) {
    if (err instanceof WitError) state.parseErrors.push(err);
    else throw err;
  }
}

function resolveInto(
  state: DocumentState,
  uri: string,
  overlay: ReadonlyMap<string, string>,
): void {
  if (!state.parsed) return;
  const fsPath = fsPathFromUri(uri);
  try {
    const resolved = resolve(state.parsed, {
      rootPath: fsPath ?? undefined,
      fileReader: fsPath ? makeFileReader(overlay) : undefined,
    });
    state.resolved = resolved;
    state.referencedPaths = [...resolved.resolvedFiles.keys()];
  } catch (err) {
    if (err instanceof ResolverError || err instanceof WitError) state.resolveErrors.push(err);
    else throw err;
  }
  state.positionIndex = buildPositionIndex(state.parsed);
}
