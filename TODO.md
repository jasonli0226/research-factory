# TODO

Status as of 2026-10-24: research phase works end to end (planner → parallel researchers →
citation verifier → repair rounds), and the synthesizer, solution-generator and red-team
stages exist. The stages were tuned on a private brief; the public test case is now
`tests/fixtures/llm-domain-adaptation.brief.md` (adapting an open-weight LLM to a domain task).
Run outputs are gitignored.

## Next

- [ ] Live run on the LLM adaptation brief (`npm run factory -- tests/fixtures/llm-domain-adaptation.brief.md`);
      first live run of the synthesizer, solution-generator and red-team stages
- [ ] Re-check each tuned skill on that run; fix anything that only worked on the old domain
- [ ] Before publishing: fresh history (squash) or `git filter-repo`, since earlier commits hold
      the private brief
- [x] `--reverify` mode: `npm run factory -- --reverify runs/<id>`; re-checks an existing run's citations
- [x] Synthesizer skill: tuned by hand on the first run (`findings.md`, ~$0.10, ~2.5 min);
      cites `[Qn.Sm]`; all markers valid, none dropped. Remaining overreach (academic
      result framed as deployed-design evidence) left for red-team
- [x] Findings citation check: `checkFindingsCitations(runDir)` in
      `orchestrator/src/findings-check.ts`; passes on the first run
- [x] Synthesizer stage in the orchestrator, validated by the citation check; skipped when every
      sub-question is excluded. Not yet run live (unit tests only)
- [x] Solution-generator skill: tuned by hand on the first run (`options.md`, ~$0.003/run);
      4-5 options scored 1-5 per criterion, no recommendation. Model still sometimes edits quotes
- [x] Options check (`orchestrator/src/options-check.ts`) and solution-generator stage in the
      orchestrator; caught the edited quotes in 5 of 10 hand runs. Not yet run live
- [x] Red-team skill: tuned by hand on DeepSeek flash (`critique.md`, ~$0.01/run); score
      challenges, severity-tagged objections, unconfirmed figures, missing options
- [x] Critique check (`orchestrator/src/critique-check.ts`) and red-team stage on DeepSeek flash,
      fallback DeepSeek v4 flash (Kimi K3's max_tokens reservation exceeds the weekly key
      limit). Hand runs pass the check 3/4 (primary) and 2/2 (fallback). Not yet run live
- [x] Proposal-writer skill: tuned by hand on GLM flash over 15 runs (`proposal.md`, ~$0.0005/run,
      ~1,900-2,300 words); names one option or a pilot, uses post-critique scores, answers open
      objections. 1 run in 5 still writes a bare `[Qn]` marker; the check must catch it
- [x] Proposal check (`orchestrator/src/proposal-check.ts`) and proposal-writer stage; the check
      rejects bare `[Qn]` markers (11 of 15 hand runs). Runs now end at proposal-complete. Not yet run live
- [x] Evaluator skill + rubric (`rubrics/default.md`, six weighted criteria) + four personas
      (`rubrics/personas/`) plus one from the brief's Audience → `eval.json`; tuned by hand on
      DeepSeek flash (~$0.001/run) against a good, a weak and three planted-flaw proposals: good
      scores 0.88-0.98, every flawed one < 0.8 with its flaw in `mustFix` (3/3 runs each)
- [x] `eval.json` check (`orchestrator/src/eval-check.ts`) and evaluator stage on DeepSeek flash;
      the rubric goes in the prompt and the evaluator's sessions go to `runs/.evaluator-sessions/`,
      so neither lands in the run directory. Runs now end at evaluation-complete. Not yet run live
- [x] Proposal ↔ evaluator revision loop (`orchestrator/src/revision.ts`): revise from the best
      draft until score ≥ `minEvalScore` with no mustFix, at most `maxRevisionRounds`; rounds kept in
      `rounds/`. Hand test: one revision fixed each planted flaw (0.63 → 0.88, 0.71 → 0.80,
      0.63 → 1.0). Runs end at proposal-accepted or below-threshold. Not yet run live
- [x] Live run on the LLM adaptation brief, end to end: proposal-accepted at 0.88 in round 0, 10/10
      verified, $0.16. The writer fell back to DeepSeek after GLM wrote `[Qn (Gaps)]` markers twice,
      so the same family wrote and graded the proposal
- [x] Retries are told why the previous output failed its check; GLM then fixed `[Qn (Gaps)]` markers
      on the retry in 2 of 2 trials that needed one
- [x] Evaluator skips models from the writer's family and uses `crossFamily` instead
      (`orchestrator/src/model-family.ts`); the run fails if no other family is configured

## Improvements

- [ ] Red-team and evaluator on a different model family than the writer
      (Anthropic/OpenAI/Google blocked on this OpenRouter account with 403 ToS error;
      kimi and deepseek work)
- [ ] Researcher skill: look for free working-paper/preprint versions when the journal page is 403
- [ ] Verifier: handle PDF line numbers glued to words ("which5 ultimately") without
      hiding fabricated numbers
- [ ] Verifier: check that claims are supported by their quotes (currently only checks the quote exists)
- [ ] Orchestrator log output via a logger instead of console.log; resume an interrupted run

## Known facts

- pi exits 0 on provider errors; failure is the final `stopReason: "error"` in `--mode json`
- pi renames its process to `pi` (no args visible in `ps`)
- Node fetch needs `setDefaultAutoSelectFamilyAttemptTimeout(2000)`; default 250 ms fails slow servers
- SearXNG must be running: `docker compose up -d searxng`
- OpenRouter key has a $10/week limit
- pi sometimes hangs before the first model call (no output, no session file); a retry works
