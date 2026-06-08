# Programming rules

Hard constraints for the codebase. Each rule has a reason. When the reason no longer applies, the rule can be revisited — but not silently.

---

## 1. Files stay under 350 lines

If a file grows past 350 lines, that is a signal to extract an abstraction. Split into modules, lift shared types into their own file, separate concerns.

**Why.** When a file gets long, the reader loses the thread. The number is not sacred — it is the trip wire. Crossing it means: pause, look at what this file is doing, and ask whether two responsibilities are tangled inside it.

**How to apply.** When a file approaches the limit during work, stop and extract before continuing. Don't push past and "clean up later."

---

## 2. Functions stay at 20 lines

If a function cannot fit in 20 lines, extract chunks into smaller helper functions — usually local or private to the same module, named for what they do.

**Why.** A 20-line function fits in working memory. Beyond that, the reader is doing surgery while the patient bleeds. Local helpers keep the top-level function readable as an outline of named steps.

**How to apply.** When a function grows, look for sequential chunks separated by blank lines or comments — each of those is a candidate helper. Name the helper for the *intent* of the chunk, not its mechanics.

---

> **Note (revised orchestration):** Rules 3–5 below describe the original 4-agent
> cycle. **Rule 6 supersedes them for current operation.** The original design was
> correct in intent (preserve main-session context) but the per-task overhead made
> work impractically slow. Rule 6 keeps the discipline (one task at a time, branch
> per task, self-review against rules) while collapsing the per-task work into a
> single dispatch with a shared context artifact.

## 3. One task at a time, via two sub-agents

Implementation work flows through a fixed two-agent loop, one task at a time:

1. **Implementer agent** — given the task brief, creates a branch and makes the changes.
2. **Reviewer agent** — reviews the diff *and* reads the upcoming tasks in the plan. Flags two things:
   - **Defects** — bugs, missed edge cases, violations of rules 1 and 2.
   - **Downstream impact** — changes that will conflict with, complicate, or invalidate assumptions in future tasks.
3. **Resolve** — main session handles the reviewer's feedback. Defects bounce back to the implementer. Downstream-impact flags may require adjusting the plan or the current task before merging.
4. **Merge** — when the reviewer approves and any plan adjustments are recorded, the branch merges into `main`.
5. **Next task** — only after the previous task is merged. Never run two tasks in parallel.

**Why.** Sub-agents run in their own context windows. Doing implementation and review inside the main session burns context fast on details that stop mattering once the task lands. Delegating preserves the main session's context for plan-level orchestration, not line-level work.

**How to apply.**
- Main session orchestrates: brief → dispatch implementer → receive report → brief reviewer → receive report → resolve → merge → repeat.
- Reviewer's reading scope: the diff, the affected files in full, the relevant `PLAN.md` section, the next 3–5 tasks in the plan.
- Tasks run strictly one at a time. Even when two tasks look independent, they serialize — the point is the discipline, not a side effect.
- A task is not complete until its branch is on `main`. "Implemented but not reviewed" and "reviewed but not merged" are not done states.

---

## 4. Persistent overview agent briefs each implementer

A third sub-agent — the **overview agent** — maintains a living understanding of the codebase across tasks. Its memory persists; the implementer and reviewer spin up fresh each task, but the overview agent is long-lived.

**Responsibilities:**
- **Before each task:** brief the implementer on the relevant parts of the codebase — where affected files live, conventions they follow, abstractions to reuse, what not to touch.
- **After each task:** receive the merged diff and a one-line summary; update its internal model.

**Why.** Implementers waste effort on rediscovery: re-reading files, retracing decisions, asking "where does X live?" The overview agent absorbs that cost once and amortizes it across every subsequent task. The goal is fewer reads inside implementer sessions, not a perfect codebase model.

**Per-task flow** (extends rule 3):

1. **Brief** — main session asks the overview agent to prepare a task-scoped briefing for the implementer.
2. **Implement** — implementer starts with the briefing in hand; reads fewer files because relevance is pre-filtered.
3. **Review** — reviewer runs as in rule 3.
4. **Resolve & merge** — as in rule 3.
5. **Notify** — main session forwards the merged diff + one-line summary to the overview agent.
6. **Next task** — restart at step 1.

**How to apply.**
- Briefings are task-oriented, not codebase tours. Keep them under ~300 words: "For task T, relevant files are A and B; convention X applies; existing helper H in module M does most of what you need; avoid touching Y."
- The overview agent never edits. It is read-only against the working tree and write-only into its own memory.
- The overview agent's memory survives across the entire project. If it drifts from reality, it re-reads key files to recalibrate; it doesn't trust itself blindly.

---

## 5. Tester sub-agent gates the merge

After the reviewer approves, a **tester agent** runs the test suite. The merge only happens if tests pass.

**Responsibilities:**
- Run the relevant tests for the change.
- On pass: report green; main session proceeds to merge.
- On fail: report failing tests with enough detail for the implementer to diagnose. Main session bounces the task back to the implementer with the test feedback.

**Why.** Test output is mostly noise when green — pages of "PASS" lines that would drown the main session's context. When red, the output matters but only in digest form. A dedicated tester agent absorbs the verbosity in its own context and hands back: *pass* or a structured failure report.

**Per-task flow** (final form, extends rules 3 and 4):

1. **Brief** — overview agent prepares the implementer briefing.
2. **Implement** — implementer makes changes on a branch.
3. **Review** — reviewer checks diff and downstream impact.
4. **Resolve review feedback** — defects bounce to implementer; downstream-impact flags may adjust the plan.
5. **Test** — tester agent runs the suite.
6. **Resolve test feedback** — failures bounce to implementer (restart at step 2 on the same branch); on pass, proceed.
7. **Merge** — branch lands on `main`.
8. **Notify** — overview agent receives the merged diff + one-line summary.
9. **Next task** — restart at step 1.

**How to apply.**
- Tester scope: the test suites likely affected by the diff. Run a narrow set when narrow is enough; widen when structure changes.
- Failure reports: failing test name, the assertion that failed, ~5 lines of relevant context. Not the full output.
- The tester never fixes tests. It only reports. Fixes go to the implementer.
- A task is not done until tests are green *and* the branch is on `main`.

## 6. Active orchestration: context-pack + self-reviewing implementer

**Supersedes rules 3–5 for current operation.** The original 4-agent cycle (overview brief → implementer → reviewer → tester) collapsed under per-task overhead — each task ran 5–7 agent calls, polluted the main session with multi-hundred-line returns, and burned tokens on redundant reads of PLAN.md / README.md / prior `_notes.md` files. Rule 6 preserves the principles (one task at a time, branch per task, self-review against rules 1 and 2, strict serialization) while collapsing the work into a single dispatch.

### Per-task cycle (revised)

1. **Context pack sync** — main session edits `.agent-state/context-pack.md` (small targeted Edits) to reflect the prior task's locked decisions and update the downstream horizon. ~30 seconds, no agent.
2. **Implementer agent** — *single dispatch*. Reads the pack as its mandatory input. Authors fixtures + `_notes.md`. Self-reviews against the pack's checklist. Commits on a fresh branch. Returns **≤ 20 lines:** branch name, commit SHA, one-line summary, list of new I.review items. No fixture content, no `_notes.md` dumps.
3. **Gates** — main session runs `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build` via Bash. All must exit 0. No agent.
4. **Merge** — main session merges branch into `main`, deletes the local branch, pushes.

No per-task reviewer agent, no per-task tester agent. Their work is folded into the implementer's self-review and the main session's bash gates.

### The context pack — `.agent-state/context-pack.md`

A small living file, **target ~100–150 lines**, containing only what an implementer needs for the *current* task:

- **Conventions** — narration rules, kebab-case, one-purpose-per-fixture, H2 citation form.
- **Self-review checklist** — bullets the implementer runs before committing.
- **Current task brief** — scope, fixture list, expected `_notes.md` H2s, out-of-scope tokens. Edited per-task.
- **Return format** — the ≤ 20-line output contract.

**Explicitly NOT in the pack:** locked decisions from prior tasks, open-question leans from prior tasks, downstream-task horizon. Those live in **git history** (commit messages, prior `_notes.md` merged to main) and are read by the **reviewer**, not the implementer.

The implementer **codes blind to prior decisions** for its category's local scope. Whether the work conflicts with downstream tasks or prior leans is the **reviewer's** job at the periodic batch pass.

The pack is maintained by the main session: small Edit to the current-task-brief section before each dispatch.

### Periodic batch reviewer (downstream-conflict check)

The implementer codes blind. The **reviewer** is where downstream-conflict checking happens. Every 3–4 merged tasks, a single reviewer agent runs to:

- Read the diffs landed since the last review (`git diff <last-review-sha>..main`).
- Read the **next 3–5 tasks** in the queue (scope, syntax they'll introduce).
- Flag conflicts: does any decision the implementer made (concrete proposal, fixture shape) conflict with what's coming?
- Cross-check `_notes.md` files in the batch for consistency and convention drift.
- Suggest new I.review items to lift into PLAN.md `I` section.

The reviewer is **non-blocking** — its output schedules follow-up fix tasks but does not gate the in-flight merge stream. Per-task bash gates remain the merge gate.

This split (implementer codes blind, reviewer checks downstream) is intentional: pre-loading the implementer with every prior decision was redundant — most decisions don't touch the current category, and accumulating them inflated the implementer's read cost. Conflicts are rare; checking once at review beats checking at every implementer dispatch.

### Why this shape

- **One agent dispatch per task** (~1 call vs prior 5–7).
- **Implementer reads ~200 lines** (the pack) instead of ~3000 (PLAN + README + 10 prior `_notes.md`).
- **Main-session context burned ≈ 20 lines per task** instead of multi-hundred-line dumps.
- Rules 1 (file size) and 2 (function size) still apply.
- Strict task serialization still applies — one branch at a time on `main`.
- Branch + commit + gates discipline still applies. Only the agent count shrinks.

---

This document is living. New rules land here as we discover them mid-implementation.
