// Expander pass — turns a ResolvedDocument into an ExpandedDocument.
//
// SCAFFOLD: this pass-through deep-clones the resolved document's
// children and tags the result as 'expanded-document'. Real expansion
// (inlining NodeDefs, evaluating IfStatement, unrolling EachStatement,
// resolving Interpolation, replacing BodySlot, dropping DataDef) is
// landed by subsequent M4 tasks. Until then the output mirrors the
// input children verbatim.
//
// Errors thrown here use ExpanderError (extends WitError via
// RuntimeError) with stable codes. E_EXPANSION_DEPTH_LIMIT is reserved
// for the inline-defs / iteration tasks to guard against runaway
// expansion graphs; the scaffold never throws it but the code is
// registered so callers can already pattern-match on it.

import type { Block } from '@wit/parser';
import type { ResolvedDocument } from './resolved-ast.js';
import type { ExpandedDocument } from './expanded-ast.js';

export function expand(resolved: ResolvedDocument): ExpandedDocument {
  return {
    kind: 'expanded-document',
    children: cloneChildren(resolved.children),
    loc: structuredClone(resolved.loc),
  };
}

function cloneChildren(children: readonly Block[]): Block[] {
  return children.map((child) => structuredClone(child));
}
