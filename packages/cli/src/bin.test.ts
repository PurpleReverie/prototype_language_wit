// Smoke tests for the CLI dispatcher.

import { describe, it, expect } from 'vitest';
import { runCli, HELP_TEXT, VERSION } from './bin.js';

interface Capture {
  out: string;
  err: string;
}

function mkIo(): { io: { stdout: (s: string) => void; stderr: (s: string) => void }; cap: Capture } {
  const cap: Capture = { out: '', err: '' };
  return {
    io: {
      stdout: (s) => { cap.out += s; },
      stderr: (s) => { cap.err += s; },
    },
    cap,
  };
}

describe('runCli', () => {
  it('prints help on no args', async () => {
    const { io, cap } = mkIo();
    const code = await runCli([], io);
    expect(code).toBe(0);
    expect(cap.out).toContain(HELP_TEXT);
  });

  it('prints version on --version', async () => {
    const { io, cap } = mkIo();
    const code = await runCli(['--version'], io);
    expect(code).toBe(0);
    expect(cap.out.trim()).toBe(VERSION);
  });

  it('prints help on --help', async () => {
    const { io, cap } = mkIo();
    const code = await runCli(['--help'], io);
    expect(code).toBe(0);
    expect(cap.out).toContain('Usage:');
  });

  it('returns 2 on unknown command', async () => {
    const { io, cap } = mkIo();
    const code = await runCli(['nope'], io);
    expect(code).toBe(2);
    expect(cap.err).toContain('unknown command');
  });
});
