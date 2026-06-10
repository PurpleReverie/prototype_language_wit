// Smoke test for `wit build`.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runBuild } from './cmd-build.js';

interface Cap { out: string; err: string }
function mkIo(): { io: { stdout: (s: string) => void; stderr: (s: string) => void }; cap: Cap } {
  const cap: Cap = { out: '', err: '' };
  return { io: { stdout: (s) => { cap.out += s; }, stderr: (s) => { cap.err += s; } }, cap };
}

describe('runBuild', () => {
  let tmpDir = '';
  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wit-cli-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('emits HTML to stdout when no -o given', () => {
    const file = path.join(tmpDir, 'a.wit');
    fs.writeFileSync(file, 'hello world\n');
    const { io, cap } = mkIo();
    const code = runBuild([file], io);
    expect(code).toBe(0);
    expect(cap.out).toContain('<article class="wit-doc">');
  });

  it('writes to -o path when given', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.html');
    fs.writeFileSync(file, 'hi\n');
    const { io, cap } = mkIo();
    const code = runBuild([file, '-o', out], io);
    expect(code).toBe(0);
    expect(cap.out).toContain('wrote');
    expect(fs.readFileSync(out, 'utf8')).toContain('<article');
  });

  it('writes Markdown when -o ends in .md', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.md');
    fs.writeFileSync(file, 'hello\n');
    const { io, cap } = mkIo();
    const code = runBuild([file, '-o', out], io);
    expect(code).toBe(0);
    expect(cap.out).toContain('wrote');
    const written = fs.readFileSync(out, 'utf8');
    expect(written).toBe('hello\n');
    expect(written).not.toContain('<article');
  });

  it('writes HTML for .htm extension', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.htm');
    fs.writeFileSync(file, 'hi\n');
    const { io } = mkIo();
    const code = runBuild([file, '-o', out], io);
    expect(code).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toContain('<article');
  });

  it('writes Markdown for .markdown extension', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.markdown');
    fs.writeFileSync(file, 'hi\n');
    const { io } = mkIo();
    const code = runBuild([file, '-o', out], io);
    expect(code).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toBe('hi\n');
  });

  it('rejects unknown -o extension with E_UNKNOWN_OUTPUT_FORMAT', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.pdf');
    fs.writeFileSync(file, 'hi\n');
    const { io, cap } = mkIo();
    const code = runBuild([file, '-o', out], io);
    expect(code).toBe(1);
    expect(cap.err).toContain('E_UNKNOWN_OUTPUT_FORMAT');
    expect(cap.err).toContain('--format');
  });

  it('--format md overrides extension inference', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.html');
    fs.writeFileSync(file, 'hi\n');
    const { io } = mkIo();
    const code = runBuild([file, '-o', out, '--format', 'md'], io);
    expect(code).toBe(0);
    const written = fs.readFileSync(out, 'utf8');
    expect(written).toBe('hi\n');
    expect(written).not.toContain('<article');
  });

  it('--format html overrides .md extension', () => {
    const file = path.join(tmpDir, 'a.wit');
    const out = path.join(tmpDir, 'a.md');
    fs.writeFileSync(file, 'hi\n');
    const { io } = mkIo();
    const code = runBuild([file, '-o', out, '--format', 'html'], io);
    expect(code).toBe(0);
    expect(fs.readFileSync(out, 'utf8')).toContain('<article');
  });

  it('rejects invalid --format value', () => {
    const file = path.join(tmpDir, 'a.wit');
    fs.writeFileSync(file, 'hi\n');
    const { io, cap } = mkIo();
    const code = runBuild([file, '--format', 'pdf'], io);
    expect(code).toBe(2);
    expect(cap.err).toContain('--format');
  });

  it('returns 2 on missing arg', () => {
    const { io, cap } = mkIo();
    const code = runBuild([], io);
    expect(code).toBe(2);
    expect(cap.err).toContain('missing');
  });
});
