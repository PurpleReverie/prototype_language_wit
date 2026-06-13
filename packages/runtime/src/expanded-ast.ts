// Expanded-AST shape produced by the expander pass.
//
// An ExpandedDocument is the final form of a Wit document after the
// expander has:
//   - Inlined every bound NodeUse against its NodeDef body.
//   - Evaluated IfStatement nodes down to a single branch (or removed).
//   - Unrolled EachStatement nodes into per-item block sequences.
//   - Resolved Interpolation nodes to their textual result.
//   - Replaced BodySlot nodes with the use-site body content.
//   - Removed DataDef nodes (consumed during binding).
//
// For the M4.expander-scaffold pass-through, none of the transforms run
// yet; the expander just deep-clones the resolved document's children
// and tags the result as 'expanded-document'. Subsequent M4 tasks
// (inline-defs, eval-conditions, eval-iteration, lh-bridge) replace
// the pass-through with real expansion logic.
//
// We deliberately reuse the parser's Block / Inline types so existing
// renderers and AST visitors can consume an ExpandedDocument without
// learning new shapes. The "EXCEPT" list above describes nodes that
// will no longer appear once expansion is complete, not new node kinds.

import type { Block, Loc } from '@witlang/parser';

export interface ExpandedDocument {
  kind: 'expanded-document';
  children: Block[];
  loc: Loc;
}
