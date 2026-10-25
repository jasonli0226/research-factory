---
name: proposal-writer
description: Write the final solution proposal for the brief's audience. Use after red-team, and again on each revision round.
---

# proposal-writer

## Inputs
- `brief.md`
- `findings.md`, `options.md`, `critique.md`
- `eval.json` from the previous round, if any

## Outputs
- `proposal.md`: one recommendation the brief's reader can approve or reject, with the
  trade-offs, open objections and first steps they need to act on it

## Procedure
1. Read `brief.md`. Note the question, constraints, decision criteria and the Audience
   section: who decides, and the list of what they need.
2. Read `options.md` and `critique.md`. For each option, take its scores after the critique:
   use the critique's Suggested score wherever it challenged one. List each option's fatal and
   major objections.
3. Drop every option with a fatal objection. From the rest, choose the option that best meets
   the decision criteria, criteria earlier in the brief's list weighing more.
4. Decide the form of the recommendation:
   - If one option leads clearly, recommend it.
   - If the top two options are within one point of each other on each of the first two
     criteria, or the leading option's score on criterion 1 or 2 is
     `unknown`, recommend a pilot: name the leading option, the
     option it is compared against, how long the pilot runs, what it measures, and which result
     picks the winner.
5. For the chosen option, answer every fatal and major objection the critique raised against
   it: how the plan reduces it, or that it remains open and what that means for the reader.
6. Write `proposal.md` in the format below, for the reader in the brief's Audience section.
7. If `eval.json` exists, this is a revision. Keep the proposal and change only what fixes each
   `mustFix` item and the persona feedback. Change the recommendation only when a `mustFix`
   item shows it breaks a constraint or contradicts the findings.

## Output format (`proposal.md`)

```markdown
# Proposal: <short title from the brief's question>

## Recommendation
<2-4 sentences: the option by letter and name, or the pilot, and the single main reason, in
the reader's language>

## Why this option
| Criterion | Score | Why |
|---|---|---|
| 1. <criterion from the brief> | <score after critique, 1-5 or unknown> | <reason> [Q3.S2] |
...

**Where it is weaker:** <the criteria where it scores 3 or lower or another option scores
higher, and what the reader gives up>

## Options not chosen
- **Option B: <name>**: <one or two sentences on why not, with markers>
...

## <one section per item in the brief's "They need ..." list, in that order>
- <at most 5 bullets: what the reader needs on that item for the recommended option>

## Risks and open objections
- **<objection title>** (<severity from the critique>): <what the plan does about it, or
  "open"> [Q2.S4]
- **<gap title>**: <what is not known and how the plan finds out> (no published evidence)
- **Weak evidence:** <each figure the recommendation relies on that findings label vendor-,
  operator- or self-reported, single-study or preprint>

## What would change this decision
- <a result or signal, and the option the reader should switch to>

## First steps
1. <action the reader can start now, who it needs and what it produces>
...
```

Skip the "They need" sections the earlier sections already cover in full. Leave out a
pilot's details when the recommendation is a single option, and add a `## Pilot` section after
Recommendation when it is a pilot: options compared, duration, measures, deciding result.

## Rules
- Write only `proposal.md`.
- Use only facts from `brief.md`, `findings.md`, `options.md` and `critique.md`. Your
  recommendation and arguments are your own; your facts are not. Never invent sources, markers,
  numbers, product names, methods or standards.
- Every factual sentence ends with markers copied from `findings.md`, each one exactly
  `[Qn.Sm]`. One marker per bracket: `[Q3.S2][Q3.S4]`. A sentence with no supporting finding
  gets no marker and must read as your judgement.
- A marker always has both numbers, `[Q6.S2]`. When a sentence names a gap, something no
  source reports, or work the reader must do to find out, end it with `(no published evidence)`
  in place of a marker.
- Durations, costs and team sizes that no finding gives are estimates: write "estimate" next
  to each one.
- Paraphrase in your own words. Do not use quotation marks; the markers lead to the exact
  quotes.
- Write for the reader, not about the process. Attribute evidence to its source type
  ("published studies", "the vendor", "the team that built it"), never to the documents you
  read: no "findings", "critique", "red team", "stage", "marker" or "sub-question" in the
  prose. Name options by letter and name.
- Keep the proposal under 2,000 words. The Recommendation and the score table
  come first so the reader can stop there; keep detail short and let the markers carry it.
- Use the critique's scores where it challenged them, never the original ones it challenged.
- Keep vendor-reported and operator-reported figures labelled as such.
- Stay within the brief's scope and constraints. The recommendation must not break a
  Constraint or need anything the brief marks out of scope.
