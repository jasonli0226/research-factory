---
name: synthesizer
description: Merge verified research notes into layered findings. Use after all notes pass verification.
---

# synthesizer

## Inputs
- `brief.md`
- `research-status.json`: status and dropped source ids for each sub-question
- `notes/<id>.md` and `notes/<id>.sources.json` for each sub-question

## Outputs
- `findings.md`: pyramid layout (one line, one paragraph, full detail), citations kept

## Procedure
1. Read `brief.md`. Note the question, decision criteria and audience.
2. Read `research-status.json`. For each sub-question note its status and `droppedSourceIds`:
   - `verified`: use all its sources.
   - `partial`: use its sources except the dropped ids.
   - `excluded`: do not use its notes at all; list it under Coverage.
3. Read every usable `notes/<id>.md`. Read `notes/<id>.sources.json` when you need to check what
   a source actually says or whether it is a vendor or self-reported figure.
4. Drop every claim whose only support is a dropped source. If a claim has other usable
   markers, keep it with only those markers.
5. Group the surviving claims by theme, not by sub-question. Pick 4-8 themes that map onto
   the brief's decision criteria (for example: data and inputs, methods and results,
   robustness, cost and effort, integration with existing work, real-world deployments).
6. Merge claims that say the same thing from different sub-questions and keep all their markers.
   Where sources conflict, keep both sides and put the conflict under Disagreements.
7. Write the full detail first, then the Summary paragraph, then the Bottom line.
8. Write `findings.md` in the format below.

## Citation markers
Source ids repeat across sub-questions, so always prefix them with the sub-question id:
`[Q3.S2]`. Rewrite a note's `[S2]` as `[Q3.S2]` when you carry the claim over. Several markers
go side by side: `[Q1.S2][Q4.S1]`.

## Output format (`findings.md`)

```markdown
# Findings: <short title from the brief's question>

## Bottom line
<one sentence of at most 40 words: what the evidence shows about the brief's question>

## Summary
<one paragraph, 4-7 sentences: the answer, the strongest evidence, and the main caveat.
Every factual sentence has markers.>

## Findings by theme

### <Theme 1>
- <claim, with numbers labelled by setting, year and unit as the source gives them> [Q1.S2]
- <claim> [Q3.S1][Q5.S4]

### <Theme 2>
...

## Disagreements and uncertainty
- <conflicting results, single-site evidence, vendor or self-reported figures> [Q2.S3]

## Gaps
- <what no sub-question could establish, merged from the notes' Gaps sections> (Q4, Q6)

## Coverage
- Q1 verified · Q2 partial (dropped S3, S4) · Q3 excluded: <reason>
```

## Rules
- Write only `findings.md`.
- Use only claims and sources from the notes. Never add facts from your own knowledge, even
  well-known ones. Never invent sources, markers or numbers.
- Every factual claim in Bottom line, Summary, Findings and Disagreements needs at least one
  marker. The Bottom line may carry no markers only if every point in it is cited in the Summary.
- Every marker must be `[Qn.Sm]` where `Sm` exists in `notes/Qn.sources.json` and is not
  in that question's `droppedSourceIds`.
- Never cite a sub-question with status `excluded`.
- Keep each study's numbers in its own clause with its own markers. Never use one setting's or
  study's figure as an example inside a sentence about a different setting or study.
- In Gaps, name the sub-questions in plain parentheses, (Q4), not as markers.
- Copy numbers exactly, with the setting, year, unit and metric the note gives them. Do not
  round, average or combine numbers from different studies into a new figure.
- Keep vendor case-study and press-release figures labelled as such ("vendor-reported",
  "operator-reported"); do not present them as independent results.
- Do not recommend a solution, not even in the Bottom line ("the proven pattern is", "teams
  should"). State what the evidence shows; option design comes later.
