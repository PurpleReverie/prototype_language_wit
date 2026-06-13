// Cross-file helpers: fs reader that prefers in-memory overlay text,
// URI ↔ fs-path conversion, dependent-tracking inverted index.

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { FileReader } from '@witlang/runtime';

export function fsPathFromUri(uri: string): string | null {
  if (!uri.startsWith('file://')) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}

export function uriFromFsPath(absPath: string): string {
  return pathToFileURL(absPath).toString();
}

// A FileReader for the resolver. Tries overlay first (in-memory edits
// from the editor), falls back to disk. Synchronous because resolver is
// synchronous.
export function makeFileReader(
  overlay: ReadonlyMap<string, string>,
): FileReader {
  return (absPath: string): string => {
    const live = overlay.get(absPath);
    if (live !== undefined) return live;
    return readFileSync(absPath, 'utf8');
  };
}

// Tracks which documents reference which other documents so a change to
// document A can invalidate every dependent.
export class DependentIndex {
  // referenced fs-path → set of dependent fs-paths
  private deps = new Map<string, Set<string>>();

  update(dependent: string, referenced: readonly string[]): void {
    this.removeAsDependent(dependent);
    for (const ref of referenced) {
      const set = this.deps.get(ref) ?? new Set<string>();
      set.add(dependent);
      this.deps.set(ref, set);
    }
  }

  dependentsOf(absPath: string): string[] {
    return [...(this.deps.get(absPath) ?? [])];
  }

  // Transitive closure: who depends (directly or via chain) on absPath?
  transitiveDependents(absPath: string): string[] {
    const out = new Set<string>();
    const queue = [absPath];
    while (queue.length > 0) {
      const head = queue.shift()!;
      for (const dep of this.dependentsOf(head)) {
        if (!out.has(dep)) { out.add(dep); queue.push(dep); }
      }
    }
    return [...out];
  }

  private removeAsDependent(dependent: string): void {
    for (const set of this.deps.values()) set.delete(dependent);
  }
}
