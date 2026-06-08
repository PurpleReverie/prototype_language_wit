# `!!` lexer state machine

This spec pins the lexer-level disambiguation of the `!!` token. It
is the implementation companion to R2/R5 in
`tests/M1-RECONCILIATIONS.md`. The reconciliation memo discussed a
dual-role option; the **adopted v1.0 resolution is
definition-only**. See "Cross-reference to R5" at the bottom for why
the use-side short-close form was killed.

## Adopted rule (one sentence)

`!!` is recognised only when the lexer is inside an open definition
value (single-line or value-block). Everywhere else `!!` is two
literal bang bytes.

## States

The lexer carries a small context stack. The states relevant to
`!!` recognition are:

- **NORMAL** — top-level prose, body of a use-side block-form
  (`@name ... name@`), body of a parens-form, inside an `(if)` or
  `(each)` body, inside a record value, inside a collection item,
  inside a pipe value. The catch-all "no open definition value."
- **IN_DEFINITION_VALUE** — there is an open definition value on
  the context stack. Subdivides into the two value shapes:
  - **IN_SINGLE_LINE_VALUE** — opener was `#name:` followed by
    same-line value bytes. The value runs until `!!` or
    end-of-line + paragraph-boundary.
  - **IN_DEFINITION_VALUE_BLOCK** — opener was `#name:` followed
    immediately by a newline. The value runs across multiple lines
    until a line whose first non-whitespace bytes are `!!`.
- **IN_REFERENCE_INVOCATION** — the lexer is between `@name` and
  any body bytes belonging to a use-side construct (block-form,
  parens-form, or bare reference). Reserved as a state so the
  use-side rejection of `!!` is explicit, not implicit.

## State diagram

```
                       +-----------+
                start->|  NORMAL   |<--------------------+
                       +-----+-----+                     |
                             |                           |
              sees `#name:` on a fresh line               |
                             |                           |
                             v                           |
                +------------+-------------+             |
                |   (peek next char)       |             |
                |   newline -> VALUE_BLOCK |             |
                |   other   -> SINGLE_LINE |             |
                +------+--------------+----+             |
                       |              |                  |
                       v              v                  |
        +--------------------+   +--------------------+  |
        | IN_SINGLE_LINE     |   | IN_DEFINITION_     |  |
        |     _VALUE         |   |   VALUE_BLOCK      |  |
        +----+---------------+   +---------+----------+  |
             |                             |             |
       sees `!!` on this line        sees `!!` as the    |
       (any column)                  first non-ws bytes  |
             |                       of a new line       |
             |                             |             |
             +--------------+--------------+             |
                            |                            |
                            v                            |
                       emit DEF_VALUE_END                |
                            |                            |
                            +----------------------------+

                       +------------------------+
       sees `@name` -->| IN_REFERENCE_INVOCATION|
                       +-----------+------------+
                                   |
            (parens / pipe / body / close)
                                   |
                                   v
                                NORMAL
                       (!! never recognised here)
```

## Transitions in detail

### NORMAL

- On byte sequence `#`, identifier, `:` at a paragraph-leading
  position: push **IN_DEFINITION_VALUE**. Inspect the next byte:
  - newline -> **IN_DEFINITION_VALUE_BLOCK**.
  - any other byte -> **IN_SINGLE_LINE_VALUE**.
- On `@name`: push **IN_REFERENCE_INVOCATION**.
- On `!!`: emit two `BANG` tokens (literal). No state change.

### IN_SINGLE_LINE_VALUE

- On `!!`: emit `DEF_VALUE_END`. Pop state. Return to NORMAL.
- On newline before `!!` is seen: emit
  `E_UNCLOSED_DEFINITION` (single-line value must close on the
  same line) per PLAN.md I.58 / DS-15.

### IN_DEFINITION_VALUE_BLOCK

- On a line whose first non-whitespace bytes are `!!` followed by
  end-of-line (with optional trailing whitespace per I.56): emit
  `DEF_VALUE_END`. Pop state. Return to NORMAL.
- On `!!` mid-line (not at line-start): two literal bang bytes,
  same as NORMAL. The terminator must own its own line.
- On EOF before terminator: emit `E_UNCLOSED_DEFINITION` at the
  opener loc.

### IN_REFERENCE_INVOCATION

- On `!!`: **two literal bang bytes**. The use-side short-close
  is rejected (R5). No close, no error — just prose.
- On `name@` matching the open `@name`: emit `NODE_CLOSE`. Pop
  state. Return to NORMAL.
- On `(` immediately after the name: switch to parens-form
  tokenisation; the parens-form is strictly self-closing.

### Body prose with no open value (the "open edge")

`!!` inside body prose with no `#name:` value context active is
**literal text** — two bang bytes. This is the catch-all NORMAL
behaviour. No reservation, no escape, no error. Authors who want
the literal sequence `!!` in prose simply type it.

## Trigger summary: when is `!!` the terminator?

| Context | `!!` means |
|---|---|
| IN_SINGLE_LINE_VALUE | DEF_VALUE_END (terminator) |
| IN_DEFINITION_VALUE_BLOCK, line-start | DEF_VALUE_END (terminator) |
| IN_DEFINITION_VALUE_BLOCK, mid-line | literal bytes |
| IN_REFERENCE_INVOCATION | literal bytes (rejected as close) |
| NORMAL (top-level / body / pipe / record / etc.) | literal bytes |

## Cross-reference to R5 (use-side rejection)

R2 in `tests/M1-RECONCILIATIONS.md` floated a dual-role
disposition that let `!!` close either an open `#name:` value or
an open `@name ...` use-side body, with LIFO disambiguation. The
v1.0 resolution **rejects the use-side branch**: to write a short
form without the named close, authors use the parens-form
`@name(body)` instead.

Reasons future maintainers should not "fix" this back to dual-role:

1. The LIFO disambiguation is correct but expensive: every
   `!!` byte requires the lexer/parser to consult the open-
   context stack, which couples the lexer to construct state
   beyond what the rest of the surface needs.
2. The parens-form `@name(body)` already supplies a short
   inline-or-block surface; nothing the dual-role rule expressed
   is unreachable without `!!`.
3. M1.04 short-close fixtures (DS-21 family in
   `tests/fixtures/04-nodes-use/`) and the M1.17 fixtures that
   exercised use-side `!!` must be re-classified in M2 as
   **expected-error** (or rule-overridden where the surface they
   exercised is reachable via parens-form). The re-classification
   is mechanical; the fixtures are not lost, just relabelled.
4. The disambiguation precedence in R5 collapses to "terminator
   only inside an open `#name:` value." Two states, one trigger.

## Cross-references

- `tests/M1-RECONCILIATIONS.md` R2, R5.
- `PLAN.md` I.7, I.16, I.17, I.56, I.58, I.130.
- `PLAN.md` C (Architecture) — resolution-timing table.
- DS-4 (use-side parser design), DS-6 (definition-side parser
  design), DS-21 (short-close disposition, now use-side rejected).
