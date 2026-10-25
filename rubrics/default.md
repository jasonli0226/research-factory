# Rubric

Score each criterion from 0 to 1 in steps of 0.25. Weights sum to 1; the overall score is the
weighted sum. A criterion's "Must fix when" condition puts an item in `mustFix` whatever the
score.

## C1: Claims match the evidence (weight 0.25)
- 1: every figure and claim is as strong as its source allows; vendor-, operator- or
  self-reported, single-site and preprint evidence is labelled as such where it is used.
- 0.5: one or two claims are stronger than their source, or a weak-evidence label is missing.
- 0: the recommendation rests on a claim the evidence does not support, such as "proven",
  "independently confirmed" or "best" for single-site, self-reported or vendor figures.
- Must fix when: any claim the recommendation depends on is stronger than its source.

## C2: Objections are answered (weight 0.25)
- 1: every fatal and major objection against the recommended option appears, with what the
  plan does about it or a plain statement that it stays open.
- 0.5: all appear, but one is waved away without a reason or a plan.
- 0: a fatal or major objection against the recommended option is missing.
- Must fix when: a fatal or major objection against the recommended option is missing or
  dismissed without a reason.

## C3: Markers support their claims (weight 0.15)
- 1: each checked marker points to a finding that says what the sentence claims.
- 0.5: one marker points to a finding on the same topic that does not support the claim.
- 0: several markers point to findings that do not support their claims.
- Must fix when: a marker on a figure or on the main reason for the recommendation does not
  support its claim.

## C4: The reader gets what they asked for (weight 0.15)
- 1: every item in the brief's Audience "They need ..." list is covered, in words that
  reader uses.
- 0.5: one item is thin, or the language is wrong for the reader in places.
- 0: an item is missing, or the proposal is written for a different reader.
- Must fix when: an item from the "They need ..." list is missing.

## C5: First steps are actionable (weight 0.1)
- 1: each first step names an action, who it needs and what it produces; the reader could
  start the next working day.
- 0.5: some steps are vague ("set up governance", "align stakeholders").
- 0: most steps are vague or there are none.
- Must fix when: no first step could be started without further planning.

## C6: Constraints and scope are kept (weight 0.1)
- 1: the recommendation, plan and first steps keep every line of the brief's Constraints and
  stay inside its Scope.
- 0: any part of the proposal breaks a Constraint or relies on something out of Scope.
- Must fix when: always, if the score is 0.
