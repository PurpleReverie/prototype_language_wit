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

---

This document is living. New rules land here as we discover them mid-implementation.
