# research-factory

An agent factory for topic research and solution proposals. It applies the
agent "software factory" pattern to research: a brief goes in, stage agents
(pi) do the work, deterministic gates verify it, and a hidden rubric scores
the proposal before a human reviews it.

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

pi (1.1.0, `@earendil-works/pi-coding-agent`) must be installed and logged in to a provider.

## Web tools (pi extension)

`extensions/web-tools` adds three tools, no API keys needed:

| Tool | Backend |
|---|---|
| `web_search` | Local SearXNG, falls back to DuckDuckGo HTML |
| `paper_search` | OpenAlex academic API |
| `web_fetch` | Direct HTTP, HTML to text (no PDFs yet) |

```bash
pi --extension ./extensions/web-tools --tools read,write,web_search,paper_search,web_fetch
```

## Commands

```bash
npm test                                  # unit tests
npm run typecheck
npm run factory -- path/to/brief.md       # plan + research + verify (later stages TODO)
npm run verify -- runs/<run-id>           # citation gate, writes verification.json
```

## Orchestrator

`npm run factory -- path/to/brief.md` creates `runs/<date>-<brief-name>/` and runs:

1. **planner** writes `backlog.md`
2. **researcher** per sub-question, `maxParallelResearchers` at a time
3. **verifier** checks that question's citations; on failure the researcher gets a
   **repair** prompt listing each problem, up to `maxRepairRounds` times
4. Writes `research-status.json` and `run.json` (factory commit, models, cost, every attempt)

### Fallbacks

| Failure | Handling |
|---|---|
| Page fetch error (timeout, 5xx, 429) | Verifier retries twice with backoff; 404/410 are not retried |
| Quote not found, bad marker, invalid sources file | Repair rounds with the verifier's feedback |
| Still failing after repairs | Run continues: question is `partial` (failed sources dropped) or `excluded` (nothing verified) |
| pi/model error (pi exits 0 on provider errors; the JSON stream's stop reason is checked) | Retry the primary model once, then the stage's `fallback` model |
| Stage output missing (no `backlog.md`, no notes) | Counts as a failed attempt |
| Spend reaches `maxUsdPerRun` | No new stage starts; remaining questions are `excluded` |

pi session logs for every stage are kept in `runs/<id>/sessions/` for auditing.

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
- Red-team and evaluator run on a different provider than proposal-writer.
- Each run records the factory commit and models used in `eval.json`.

## Roadmap

1. Tune each stage skill by hand in pi on a real brief
2. ~~Verifier: fetch URLs, match quotes, write `verification.json`~~ done
3. Orchestrator: research phase with fallbacks done; later stages TODO
4. Evaluator loop with budgets and thresholds
5. Optional: pi extension, brief queue, scheduled runs

## License

[MIT](LICENSE)
