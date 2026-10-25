---
name: planner
description: Split a research brief into independent sub-questions. Use at the start of a factory run.
---

# planner

## Inputs
- `brief.md`

## Outputs
- `backlog.md`: numbered sub-questions, each answerable on its own

## Procedure
1. Read `brief.md`. Note the question, scope, constraints, decision criteria and audience.
2. List what the proposal writer must know to answer the question and score options against
   every decision criterion. Each item becomes a candidate sub-question.
3. Rewrite each candidate so it is:
   - answerable by one researcher from public sources in one session,
   - independent of the other sub-questions (no "based on Q2...")
   - specific (names the component, setting, data type or method it is about),
   - inside the brief's scope,
   - about one topic only (split "X, Y and Z" questions into separate ones).
4. Merge overlapping candidates. Drop any that only restate the main question.
5. Aim for 6-10 sub-questions. Cover every decision criterion at least once, and include
   at least one sub-question about real-world implementations or case studies.
6. Write `backlog.md` in the format below.

## Output format

```markdown
# Backlog

## Q1: <short title>
- Question: <one sentence, ends with ?>
- Why it matters: <which decision criterion or scope item it serves>
- Look for: <kinds of evidence: papers, vendor docs, case studies, benchmarks, standards>

## Q2: ...
```

## Rules
- Write only `backlog.md`. Do not research or answer the questions.
- Do not add questions on topics the brief marks out of scope.
- Every sub-question ends with a question mark.
