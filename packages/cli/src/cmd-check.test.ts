// Smoke test for `wit check`.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCheck } from './cmd-check.js';

interface Cap { out: string; err: string }
function mkIo(): { io: { stdout: (s: string) => void; stderr: (s: string) => void }; cap: Cap } {
  const cap: Cap = { out: '', err: '' };
  return { io: { stdout: (s) => { cap.out += s; }, stderr: (s) => { cap.err += s; } }, cap };
}

describe('runCheck', () => {
  let tmpDir = '';
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wit-cli-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('passes on a clean file', () => {
    const file = path.join(tmpDir, 'a.wit');
    fs.writeFileSync(file, 'just prose\n');
    const { io, cap } = mkIo();
    const code = runCheck([file], io);
    expect(code).toBe(0);
    expect(cap.out).toContain('ok:');
  });

  it('returns 2 on missing arg', () => {
    const { io, cap } = mkIo();
    const code = runCheck([], io);
    expect(code).toBe(2);
    expect(cap.err).toContain('missing');
  });
});
