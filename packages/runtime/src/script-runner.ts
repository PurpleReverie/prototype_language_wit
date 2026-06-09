// Script runner — executes <% %> ScriptBlocks against the lh bridge.
//
// Two phases:
//   1. Walk the expanded tree in document order. For each block-level
//      ScriptBlock, compile its content with `new Function('lh', src)`
//      and invoke it. Side effects flow through `lh` (data overlay,
//      tree mutations, injected nodes, sorted lists). The ScriptBlock
//      node itself is then dropped from the parent list.
//   2. Inline ScriptBlocks (inline === true) are evaluated for their
//      RETURN VALUE; the value gets spliced into the prose as a Text
//      node. ScriptCalls invoke a named function captured into the
//      runner's script env by an earlier block script and splice the
//      return value the same way.
//
// Last-script-wins semantics: scripts mutate shared state (overlay,
// tree, exposed functions). Later scripts see earlier scripts' changes.
//
// Security: scripts run via `new Function` with no real sandbox. They
// see only the `lh` argument plus the host's global scope. Authoring
// input is trusted by design for v1; production hardening is later.

import type {
  Block,
  Inline,
  Loc,
  Paragraph,
  ScriptBlock,
  ScriptCall,
  Text,
} from '@wit/parser';
import type { ExpandedDocument } from './expanded-ast.js';
import { ExpanderError, RuntimeErrorCode } from './errors.js';
import type { LhBridge } from './lh-bridge.js';

// Functions defined by earlier scripts and callable via @scriptCall.
export type ScriptEnv = Record<string, unknown>;

export function runScripts(
  expanded: ExpandedDocument,
  bridge: LhBridge,
): ExpandedDocument {
  const env: ScriptEnv = {};
  expanded.children = processBlocks(expanded.children, bridge, env);
  return expanded;
}

// ---------------------------------------------------------------------------
// Block-level traversal: execute block ScriptBlocks, recurse otherwise.
// ---------------------------------------------------------------------------

function processBlocks(
  blocks: readonly Block[],
  bridge: LhBridge,
  env: ScriptEnv,
): Block[] {
  const out: Block[] = [];
  for (const block of blocks) {
    if (block.kind === 'scriptBlock' && !block.inline) {
      executeBlockScript(block, bridge, env);
      continue;
    }
    out.push(processBlock(block, bridge, env));
  }
  return out;
}

function processBlock(block: Block, bridge: LhBridge, env: ScriptEnv): Block {
  if (block.kind === 'paragraph') return processParagraph(block, bridge, env);
  return block;
}

function processParagraph(
  p: Paragraph,
  bridge: LhBridge,
  env: ScriptEnv,
): Paragraph {
  return { ...p, children: processInlines(p.children, bridge, env) };
}

function processInlines(
  items: readonly Inline[],
  bridge: LhBridge,
  env: ScriptEnv,
): Inline[] {
  const out: Inline[] = [];
  for (const item of items) {
    for (const i of processInline(item, bridge, env)) out.push(i);
  }
  return out;
}

function processInline(
  item: Inline,
  bridge: LhBridge,
  env: ScriptEnv,
): Inline[] {
  if (item.kind === 'scriptBlock' && item.inline) {
    const { value } = spliceInlineScript(item, bridge, env);
    return [textNode(stringifyResult(value), item.loc)];
  }
  if (item.kind === 'scriptCall') {
    return [textNode(invokeScriptCall(item, env), item.loc)];
  }
  if (item.kind === 'italic' || item.kind === 'bold') {
    return [{ ...item, children: processInlines(item.children, bridge, env) }];
  }
  return [item];
}

// ---------------------------------------------------------------------------
// Script execution helpers.
// ---------------------------------------------------------------------------

function executeBlockScript(
  block: ScriptBlock,
  bridge: LhBridge,
  env: ScriptEnv,
): void {
  // Top-level `function NAME(...)` decls are appended with an explicit
  // `__env.NAME = NAME` so the runner captures them across block scripts.
  const exposed = captureFunctionDecls(block.content);
  const wrapped = exposed.rewritten + '\nreturn;';
  invokeWrapped(block, wrapped, bridge, env);
}

function spliceInlineScript(
  block: ScriptBlock,
  bridge: LhBridge,
  env: ScriptEnv,
): { value: unknown } {
  // Inline scripts evaluate to a single expression. Wrap in `return (...)`
  // so the runner sees the value.
  const wrapped = `return (${block.content});`;
  return { value: invokeWrappedRaw(block, wrapped, bridge, env) };
}

interface CapturedDecls {
  rewritten: string;
}

function captureFunctionDecls(source: string): CapturedDecls {
  const names: string[] = [];
  const declRe = /(^|\n)\s*function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(source)) !== null) {
    const name = m[2];
    if (name !== undefined) names.push(name);
  }
  const tail = names.map((n) => `__env[${JSON.stringify(n)}] = ${n};`).join('\n');
  return { rewritten: source + '\n' + tail };
}

function invokeScriptCall(call: ScriptCall, env: ScriptEnv): string {
  const fn = env[call.fnName];
  if (typeof fn !== 'function') {
    throw new ExpanderError(
      RuntimeErrorCode.E_SCRIPT_ERROR,
      `scriptCall references unknown function: ${call.fnName}`,
      call.loc,
    );
  }
  try {
    const value = (fn as (...args: unknown[]) => unknown)(...call.args);
    return stringifyResult(value);
  } catch (err) {
    throw wrapScriptError(err, call.loc, `@scriptCall(${call.fnName})`);
  }
}

function invokeWrapped(
  block: ScriptBlock,
  wrapped: string,
  bridge: LhBridge,
  env: ScriptEnv,
): void {
  invokeWrappedRaw(block, wrapped, bridge, env);
}

function invokeWrappedRaw(
  block: ScriptBlock,
  wrapped: string,
  bridge: LhBridge,
  env: ScriptEnv,
): unknown {
  try {
    const argNames = Object.keys(env);
    const argValues = argNames.map((k) => env[k]);
    const fn = new Function('lh', '__env', ...argNames, wrapped);
    return fn(bridge, env, ...argValues);
  } catch (err) {
    throw wrapScriptError(err, block.loc, 'scriptBlock');
  }
}

function stringifyResult(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function wrapScriptError(err: unknown, loc: Loc, where: string): ExpanderError {
  const msg = err instanceof Error ? err.message : String(err);
  return new ExpanderError(
    RuntimeErrorCode.E_SCRIPT_ERROR,
    `Script error in ${where}: ${msg}`,
    loc,
  );
}

function textNode(value: string, loc: Loc): Text {
  return { kind: 'text', value, loc: structuredClone(loc) };
}
