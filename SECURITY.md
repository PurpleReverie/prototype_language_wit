# Security policy

## Reporting

If you find a security issue, please email **tauraj.pro@gmail.com**
rather than opening a public issue. I'll respond within a week and
work with you on a coordinated disclosure timeline if needed.

## Scope

Wit is a parser library. The relevant security concerns are:

- **Malformed input causing a host process crash** — `.wit` source
  that escapes the parser's error handling and surfaces as an
  uncaught exception in a consumer.
- **Resource exhaustion** — input that causes pathological time or
  memory use (deep nesting, runaway iteration, etc.).
- **Unexpected behavior on untrusted source** — anything that lets
  a malicious `.wit` document do more than it should.

## Out of scope: untrusted scripts

`<% expr %>` script blocks execute arbitrary JavaScript through the
`@witlang/runtime` script bridge. **Consumers running untrusted `.wit`
source MUST sandbox the script runner**, or disable scripts entirely
in their integration. Out-of-the-box, Wit's bridge is a thin wrapper
around the host JavaScript context — it is not a security boundary.

## Supported versions

The latest minor of v0.x receives security fixes. Older minors do not.
