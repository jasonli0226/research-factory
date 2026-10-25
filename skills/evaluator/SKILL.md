---
name: evaluator
description: Score a proposal against the hidden rubric and stakeholder personas. Only the orchestrator runs this stage.
---

# evaluator

## Inputs
- `brief.md`, `proposal.md`
- `findings.md`, `options.md`, `critique.md`: the evidence the proposal was written from
- The rubric (`<rubric>`) and personas (`<personas>`) in the task prompt. They are never stored
  in the run directory.

## Outputs
- `eval.json` in the format below

## Procedure
1. Read `brief.md`. Note its Constraints, Scope and the Audience section's "They need ..." list.
2. Read `proposal.md`. Note which option it recommends, or which options a pilot compares.
3. Objections: in `critique.md`, list every fatal and major objection against each recommended
   or piloted option, and every cross-cutting objection. For each, find where the proposal
   addresses it. Record each one in `objections`.
4. Constraints: for each line of the brief's Constraints, check the recommendation, plan and
   first steps against it. Record each one in `constraints`.
5. Claims: check every figure and every claim in the Recommendation, the score table and
   Risks against the finding its marker points to in `findings.md`. Note claims stronger than
   their finding and markers whose finding says something else.
6. Score each rubric criterion using its scale, with the evidence from steps 3-5. A missing
   objection or a broken constraint scores the criterion at the scale's bottom.
7. Compute `score` as the weighted sum of the criterion scores, rounded to 2 decimals.
8. Write `mustFix`: one item for every rubric "Must fix when" condition that holds, each naming
   the proposal section, what is wrong and what a fixed version needs.
9. Write feedback from each persona in `<personas>`, then from one more persona: the reader
   named in the brief's Audience section, judging whether the proposal gives them what they
   asked for.
10. Write `eval.json`.

## Output format (`eval.json`)

```json
{
  "score": 0.72,
  "perCriterion": [
    { "id": "C1", "score": 0.5, "reason": "<why, naming proposal sections>" }
  ],
  "objections": [
    { "option": "A", "objection": "<title from critique.md>", "severity": "major",
      "addressed": true, "where": "<proposal section, or \"missing\">" }
  ],
  "constraints": [
    { "constraint": "<line from the brief>", "kept": false, "where": "<proposal section>" }
  ],
  "mustFix": [
    { "criterion": "C2", "section": "<proposal section>", "issue": "<what is wrong>",
      "fix": "<what a fixed version needs>" }
  ],
  "personaFeedback": [
    { "persona": "Decider", "feedback": "<2-3 sentences in that persona's voice>" }
  ]
}
```

`perCriterion` has one entry per rubric criterion, in rubric order. `personaFeedback` has one
entry per persona in `<personas>` plus the Audience persona, named after the brief's reader.

## Rules
- Write only `eval.json`. Never edit `proposal.md` or any other file.
- `eval.json` must be valid JSON in the format above.
- Judge only from the run files and the rubric. Never use outside knowledge to decide whether a
  claim is true.
- An objection counts as addressed only when the proposal names it and says what the plan
  does about it or that it stays open.
- `mustFix` items say what is wrong and what a fix needs, never the rubric's wording or scale.
