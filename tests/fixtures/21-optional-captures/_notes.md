# 21-optional-captures fixtures — authoring notes

## Optional `||a, b, c||` capture lists (no PLAN.md entry — new I.review item)

M10.core-vocab Thread 1. The capture list is now OPTIONAL:

- **Explicit form** (`with-explicit-captures.wit`): the contract is
  written by the author. Reviewer behavior unchanged.
- **Inferred form** (`without-captures-inferred.wit`,
  `block-def-inferred.wit`): when `||...||` is absent, the parser
  walks the body and collects each distinct `::ident::` name in source
  order. The result populates `NodeDef.captures` exactly as the
  explicit form does, so use-site param binding is transparent.

**Concrete proposal:** the gatherer in
`packages/parser/src/parser-captures.ts` is recursive over
Block/Inline/Record/Collection nodes. Any future Interpolation-bearing
node kind needs to be added to `walkNode`.
