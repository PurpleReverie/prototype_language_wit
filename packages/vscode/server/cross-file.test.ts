// Tests for cross-file helpers — URI conversion, dependent index,
// virtual filesystem reader.

import { describe, it, expect } from 'vitest';
import {
  DependentIndex,
  fsPathFromUri,
  uriFromFsPath,
  makeFileReader,
} from './cross-file.js';

describe('fsPathFromUri / uriFromFsPath', () => {
  it('round-trips an absolute path through URI form', () => {
    const path = '/tmp/wit/foo.wit';
    const uri = uriFromFsPath(path);
    expect(uri.startsWith('file://')).toBe(true);
    expect(fsPathFromUri(uri)).toBe(path);
  });

  it('returns null for non-file URIs', () => {
    expect(fsPathFromUri('inmemory://test')).toBeNull();
  });
});

describe('makeFileReader', () => {
  it('returns overlay text when present', () => {
    const overlay = new Map<string, string>([['/tmp/a.wit', '#x: 1 !!\n']]);
    const reader = makeFileReader(overlay);
    expect(reader('/tmp/a.wit')).toBe('#x: 1 !!\n');
  });
});

describe('DependentIndex', () => {
  it('tracks direct dependents', () => {
    const idx = new DependentIndex();
    idx.update('/a.wit', ['/shared.wit']);
    expect(idx.dependentsOf('/shared.wit')).toEqual(['/a.wit']);
  });

  it('updates the dependent set on re-registration', () => {
    const idx = new DependentIndex();
    idx.update('/a.wit', ['/shared.wit']);
    idx.update('/a.wit', ['/other.wit']);
    expect(idx.dependentsOf('/shared.wit')).toEqual([]);
    expect(idx.dependentsOf('/other.wit')).toEqual(['/a.wit']);
  });

  it('computes transitive dependents', () => {
    const idx = new DependentIndex();
    idx.update('/a.wit', ['/b.wit']);
    idx.update('/b.wit', ['/c.wit']);
    const all = idx.transitiveDependents('/c.wit').sort();
    expect(all).toEqual(['/a.wit', '/b.wit']);
  });
});
