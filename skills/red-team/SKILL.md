---
name: red-team
description: Attack each solution option to find weak assumptions, risks and missing evidence. Run on a different model than the writer.
---

# red-team

## Inputs
- `brief.md`
- `findings.md`
- `options.md`

## Outputs
- `critique.md`: per option, challenged scores, the strongest objections, unconfirmed figures
  and what evidence would resolve them

## Procedure
1. Read `brief.md`. Note the decision criteria, constraints and scope.
2. Read `findings.md`, especially Disagreements and uncertainty, and Gaps. Note how findings
   label each figure: vendor-reported, operator-reported, self-reported by the team that built
   the system, single-site study, preprint or peer-reviewed.
3. Read `options.md`. The options are deliberately unranked; treat each score as a separate
   claim to test.
4. For each option, check every score against the evidence its reason cites. Challenge a
   score when the evidence is about a different target, setting, metric or population,
   when a `(judgement)` score has no argument, or when findings contradict it.
5. For each option, find its 3-5 strongest objections: failures against the brief's
   constraints, assumptions findings do not support, risks the option ignores.
6. For each option, list every figure it relies on whose source findings label as vendor-,
   operator- or self-reported, or as a single study or preprint.
7. Find objections that apply to every option, and options the set is missing.
8. Write `critique.md` in the format below.

## Severity
Every objection carries exactly one severity tag right after its title, minor ones included.
The tag takes one of these forms:
- `(fatal: <brief section>)`: the option as designed breaks a line in the brief's Constraints
  or Scope. Name the section, e.g. `(fatal: Scope)`. A preference ("prefer ...") is not a
  constraint.
- `(major: criterion <n>, <score> → <score>)`: the objection moves one score by 2 or more,
  e.g. `(major: criterion 1, 5 → 3)`. Add the same change to Score challenges.
- `(minor)`: everything else worth fixing. When it moves a score by 1, say so:
  `(minor: criterion 1, 4 → 3)`.

## Output format (`critique.md`)

```markdown
# Critique: <short title from the brief's question>

## Cross-cutting objections
- **<short title>** (options A, B, D): <objection that applies to several options> [Q7.S1].
  Resolves it: <evidence that would settle it>

## Option A: <name as in options.md>

### Score challenges
| Criterion | Score | Challenge | Suggested |
|---|---|---|---|
| 1. <criterion> | 5 | <why the cited evidence does not support it> [Q3.S1] | 3 |

### Objections
1. **<short title>** (major: criterion 3, 4 → 2): <objection> [Q2.S6]
   Resolves it: <evidence that would settle it>

### Unconfirmed figures
- <figure, as findings give it>: <label from findings, e.g. vendor-reported> [Q1.S12]

## Option B: <name>
...

## Missing options
- <an alternative the set lacks, and which objection it answers>
```

Suggested scores use the same 1-5 scale as `options.md`, or `unknown` when no evidence could
support any score. Leave Score challenges with the header only when you challenge nothing.

## Rules
- Write only `critique.md`.
- Use only facts from `brief.md`, `findings.md` and `options.md`. Your arguments are your own;
  your facts are not. Never invent sources, markers or numbers.
- Cite findings with their markers exactly as `findings.md` gives them, `[Qn.Sm]`.
- Paraphrase in your own words. Do not use quotation marks; the markers lead to the exact
  quotes. Refer to an option's text by option letter and section.
- Label each figure exactly as findings label it. When findings give no label, call it a
  single-study figure.
- Critique each option on its own. Do not rank, total or recommend options.
