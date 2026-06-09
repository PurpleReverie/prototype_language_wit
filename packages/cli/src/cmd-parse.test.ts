// Smoke test for `wit parse` against a temporary file.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runParse } from './cmd-parse.js';

interface Cap { out: string; err: string }
function mkIo(): { io: { stdout: (s: string) => void; stderr: (s: string) => void }; cap: Cap } {
  const cap: Cap = { out: '', err: '' };
  return { io: { stdout: (s) => { cap.out += s; }, stderr: (s) => { cap.err += s; } }, cap };
}

describe('runParse', () => {
  let tmpDir = '';
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wit-cli-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('emits JSON AST for a simple file', () => {
    const file = path.join(tmpDir, 'a.wit');
    fs.writeFileSync(file, 'hello world\n');
    const { io, cap } = mkIo();
    const code = runParse([file], io);
    expect(code).toBe(0);
    const ast = JSON.parse(cap.out) as { kind: string };
    expect(ast.kind).toBe('document');
  });

  it('returns 2 on missing arg', () => {
    const { io, cap } = mkIo();
    const code = runParse([], io);
    expect(code).toBe(2);
    expect(cap.err).toContain('missing');
  });

  it('returns 1 on unreadable file', () => {
    const { io, cap } = mkIo();
    const code = runParse([path.join(tmpDir, 'nope.wit')], io);
    expect(code).toBe(1);
    expect(cap.err).toContain('cannot read');
  });
});
