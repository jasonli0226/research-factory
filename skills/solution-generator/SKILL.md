---
name: solution-generator
description: Propose several distinct solution options from the findings. Use after synthesis.
---

# solution-generator

## Inputs
- `brief.md`
- `findings.md`

## Outputs
- `options.md`: 3-5 distinct options, each scored against the brief's decision criteria

## Procedure
1. Read `brief.md`. Copy its decision criteria in order, and note its constraints and scope.
2. Read `findings.md`. Note the evidence for each approach, its deployments, and its caveats
   under Disagreements and Gaps.
3. List candidate options. Each option is a complete production design the team could build
   and run on its own as its answer to the brief's question.
4. Keep 3-5 options that differ from each other in at least one of: core approach, what they
   depend on, or build versus buy. Drop a candidate that is only a baseline, only a phase, or
   only a step toward another option. A hybrid is allowed when it is a complete design of its
   own; name the options it borrows from.
5. Score each option against each decision criterion on the scale below.
6. Write `options.md` in the format below.

## Scores
Score every criterion from 1 to 5, where 5 is always best for the brief's reader: 5 means the
best end of each criterion, for example most accurate, least effort, cheapest or fastest. Every score has a one-line reason. End the reason with markers when findings support
it, or with `(judgement)` when no finding does.

## Output format (`options.md`)

```markdown
# Options: <short title from the brief's question>

## Decision criteria
1. <criterion from the brief>
...

## Option A: <name>

**Design:** <2-4 sentences: approach, what it needs, what it delivers, how it runs, where it fits>

**Evidence:** <what findings show about this approach, with numbers labelled as the
findings give them> [Q3.S2]

| Criterion | Score | Reason |
|---|---|---|
| 1. <criterion> | 4 | <reason> [Q3.S2] |
| 2. <criterion> | 2 | <reason> (judgement) |
...

**Assumptions:** <what must hold for these scores, one bullet each>

**Main risks:** <what could make this option fail, one bullet each, with markers where findings
support them>

## Option B: <name>
...

## Comparison

| Option | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| A. <name> | 4 | 2 | 3 | 4 | 3 |
...

## Open questions
- <what the findings cannot settle that would change the scores> (Q4)
```

## Rules
- Write only `options.md`.
- Use only facts from `findings.md`. Never add facts from your own knowledge. Never invent
  sources, markers or numbers.
- Copy markers exactly as `findings.md` gives them, `[Qn.Sm]`. Cite only markers that appear
  in `findings.md`.
- Paraphrase findings in your own words and cite their markers. Do not use quotation marks;
  the markers lead to the exact quotes.
- Keep vendor-reported and operator-reported figures labelled as such.
- Do not recommend, rank or choose an option, and do not add totals or a phased plan. Choosing
  happens in a later stage.
