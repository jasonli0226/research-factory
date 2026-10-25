# research-factory

An agent factory for topic research and solution proposals. You write a brief
(the question, constraints and decision criteria); a fixed line of stage agents
researches it, compares options, critiques them and writes a proposal. Each
stage runs as a [pi](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
agent with its own skill, and each stage's output passes a deterministic check
before the next one starts. Every citation is checked against the live page.

A rubric the writer never sees scores the proposal, so the writer cannot write
to the test. Proposals that score too low are revised; the result goes to a
human for the final call.

## Pipeline

```
brief.md (human)
  -> planner            backlog.md
  -> researcher x N     notes/<id>.md + notes/<id>.sources.json   (parallel)
  -> verifier (script)  verification.json   gate: every quote found at its URL
  -> synthesizer        findings.md
  -> solution-generator options.md
  -> red-team           critique.md         (different model)
  -> proposal-writer    proposal.md
  -> evaluator          eval.json           (hidden rubric + personas)
  -> score < threshold? revise (max rounds / budget) -> human gate
```

## Layout

| Path | Purpose |
|---|---|
| `skills/` | One `SKILL.md` per stage |
| `orchestrator/` | Runs stages with `pi -p`, enforces budgets and gates |
| `verifier/` | Deterministic citation and quote checks |
| `rubrics/` | Hidden scoring rubric and stakeholder personas |
| `extensions/web-tools/` | pi extension: search and fetch tools |
| `templates/brief.md` | Start every run from this |
| `config/factory.json` | Model per stage, budgets, thresholds |
| `runs/` | Run outputs (gitignored) |

## Setup

```bash
npm install
cp .env.example .env                      # then set SEARXNG_SECRET (openssl rand -hex 32)
docker compose up -d searxng              # local search at http://127.0.0.1:8888
```

pi (1.1.0, `@earendil-works/pi-coding-agent`) must be installed and logged in to
the providers named in `config/factory.json` (OpenRouter by default).

## Quickstart

```bash
mkdir -p briefs/private                       # gitignored
cp templates/brief.md briefs/private/my-question.md   # fill in every section
npm run factory -- briefs/private/my-question.md
```

The run writes to `runs/<date>-<brief-name>/`. Read `proposal.md` and its score
in `eval.json`; `run.json` gives the final phase (`proposal-accepted`,
`below-threshold`, or the stage that failed) and the cost. The exit code is 0
when the proposal is accepted, 1 otherwise.

To try it without writing a brief, use the public test case:
`npm run factory -- tests/fixtures/llm-domain-adaptation.brief.md`.

## Web tools (pi extension)

`extensions/web-tools` adds three tools, no API keys needed:

| Tool | Backend |
|---|---|
| `web_search` | Local SearXNG, falls back to DuckDuckGo HTML |
| `paper_search` | OpenAlex academic API |
| `web_fetch` | Direct HTTP, HTML or PDF to text |

```bash
pi --extension ./extensions/web-tools --tools read,write,web_search,paper_search,web_fetch
```

## Commands

```bash
npm test                                  # unit tests
npm run typecheck
npm run factory -- path/to/brief.md       # full run, brief to evaluated proposal
npm run factory -- --reverify runs/<id>   # re-check an existing run's citations, no model calls
npm run verify -- runs/<run-id>           # citation gate, writes verification.json
```

## Orchestrator

`npm run factory -- path/to/brief.md` creates `runs/<date>-<brief-name>/` and runs:

1. **planner** writes `backlog.md`
2. **researcher** per sub-question, `maxParallelResearchers` at a time
3. **verifier** checks that question's citations; on failure the researcher gets a
   **repair** prompt listing each problem, up to `maxRepairRounds` times.
   Results go to `research-status.json`
4. **synthesizer**, **solution-generator** and **red-team** write `findings.md`,
   `options.md` and `critique.md`; each output is checked (citation markers,
   quotes, structure) and a failed check is retried with the reason
5. **proposal-writer** drafts `proposal.md`; the **evaluator** scores it into
   `eval.json`. Below `minEvalScore` or with open `mustFix` items, the writer
   revises from the evaluation, up to `maxRevisionRounds` times. Every round is
   kept in `rounds/`; the best one is left in the run directory
6. `run.json` records the final phase, factory commit, models, cost and every attempt

### Fallbacks

| Failure | Handling |
|---|---|
| Page fetch error (timeout, 5xx, 429) | Verifier retries twice with backoff; 404/410 are not retried |
| Quote not found, bad marker, invalid sources file | Repair rounds with the verifier's feedback |
| Still failing after repairs | Run continues: question is `partial` (failed sources dropped) or `excluded` (nothing verified) |
| pi/model error (pi exits 0 on provider errors; the JSON stream's stop reason is checked) | Retry the primary model once, then the stage's `fallback` model |
| Stage output missing (no `backlog.md`, no notes) | Counts as a failed attempt |
| Spend reaches `maxUsdPerRun` | No new stage starts; remaining questions are `excluded` |

pi session logs are kept for auditing: `runs/<id>/sessions/` for every stage
except the evaluator, whose logs contain the rubric and go to
`runs/.evaluator-sessions/<id>/` so writer stages cannot read them.

## Verifier

`npm run verify -- runs/<run-id>` checks every `notes/<id>.sources.json`:

- Format: valid JSON, unique ids (S1, S2, ...), http(s) URLs, non-empty quotes
- Markers: every [Sn] in `notes/<id>.md` has a source entry (unused sources are warnings)
- Quotes: each page is fetched once (HTML or PDF) and every quote must appear on it
  - `exact`: matches after normalizing case, whitespace, quote and dash characters
  - `loose`: same words in order, ignoring punctuation, bullet markers and hyphenated line breaks
  - `not_found` or `fetch_failed`: counts against the question

A question passes when it has no errors and its verified ratio meets
`thresholds.minVerifiedCitationRatio`. Exit code 0 = gate passed, 1 = failed, 2 = usage error.

## Rules

- Writer stages must never see `rubrics/`.
- The evaluator never uses a model from the proposal-writer's family: it switches
  to its `crossFamily` model, and the run fails if none is configured. Red-team is
  configured on a different family but this is not enforced yet.
- Each run records the factory commit and models used in `run.json`.

## Roadmap

1. ~~Tune each stage skill by hand in pi on a real brief~~ done
2. ~~Verifier: fetch URLs, match quotes, write `verification.json`~~ done
3. ~~Orchestrator: all stages with fallbacks and output checks~~ done
4. ~~Evaluator loop with budgets and thresholds~~ done
5. Enforce a different model family for red-team; check that quotes support claims
6. Optional: pi extension, brief queue, scheduled runs, resume interrupted runs

## License

[MIT](LICENSE)
