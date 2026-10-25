import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { QuestionReport } from "../../verifier/src/verify.js";
import { parseBacklogIds } from "./backlog.js";
import { createCostTracker, type CostTracker } from "./budget.js";
import type { FactoryConfig } from "./config.js";
import { checkCritique } from "./critique-check.js";
import { checkEval } from "./eval-check.js";
import { checkFindingsCitations } from "./findings-check.js";
import { checkOptions } from "./options-check.js";
import type { PiRunner } from "./pi-runner.js";
import { mapWithConcurrency } from "./pool.js";
import { checkProposal } from "./proposal-check.js";
import { researchQuestion, type QuestionOutcome } from "./research.js";
import { reviseUntilAccepted, type RevisionOutcome } from "./revision.js";
import { buildEvaluatorPrompt, type Rubric } from "./rubric.js";
import { runStage, type StageResult } from "./stage.js";

export type RunPhase =
  | "planner-failed"
  | "research-failed"
  | "synthesizer-failed"
  | "solution-generator-failed"
  | "red-team-failed"
  | "proposal-writer-failed"
  | "evaluator-failed"
  | "below-threshold"
  | "proposal-accepted";

export interface RunOptions {
  readonly briefPath: string;
  readonly runsDir: string;
  readonly factoryRoot: string;
  readonly factoryCommit: string;
  readonly config: FactoryConfig;
  /** Evaluator-only inputs, passed in its prompt and never written to the run directory. */
  readonly rubric: Rubric;
  readonly runner: PiRunner;
  readonly verifyQuestion: (runDir: string, qid: string) => Promise<QuestionReport>;
  readonly now?: Date;
  readonly log?: (message: string) => void;
}

export interface RunResult {
  readonly runDir: string;
  readonly phase: RunPhase;
  readonly costUsd: number;
  readonly questions: QuestionOutcome[];
}

const PLANNER_TOOLS = ["read", "write"];
const WRITER_TOOLS = ["read", "write"];
const RESEARCHER_TOOLS = ["read", "write", "web_search", "paper_search", "web_fetch"];

export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createRunDir(runsDir: string, briefPath: string, now: Date): string {
  const name = `${localDate(now)}-${slugify(basename(briefPath).replace(/(\.brief)?\.md$/, ""))}`;
  const free = (n: number): string => {
    const candidate = join(runsDir, n === 1 ? name : `${name}-${n}`);
    return existsSync(candidate) ? free(n + 1) : candidate;
  };
  const runDir = free(1);
  mkdirSync(join(runDir, "notes"), { recursive: true });
  mkdirSync(join(runDir, "sessions"), { recursive: true });
  return runDir;
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function validatePlanner(runDir: string): string | null {
  const path = join(runDir, "backlog.md");
  if (!existsSync(path)) return "backlog.md was not written";
  return parseBacklogIds(readFileSync(path, "utf8")).length > 0 ? null : "backlog.md has no ## Qn sub-questions";
}

function validateResearcher(runDir: string, qid: string): string | null {
  const missing = [`${qid}.md`, `${qid}.sources.json`].filter((f) => !existsSync(join(runDir, "notes", f)));
  return missing.length === 0 ? null : `Missing ${missing.join(", ")}`;
}

/**
 * Run the planning, research, synthesis, option-generation and red-team phases for one brief, then
 * draft, evaluate and revise the proposal until it is accepted or the revision rounds run out.
 */
export async function runFactory(opts: RunOptions): Promise<RunResult> {
  if (!existsSync(opts.briefPath)) throw new Error(`Brief not found: ${opts.briefPath}`);
  const log = opts.log ?? (() => {});
  const startedAt = opts.now ?? new Date();
  const runDir = createRunDir(opts.runsDir, opts.briefPath, startedAt);
  copyFileSync(opts.briefPath, join(runDir, "brief.md"));
  const costs: CostTracker = createCostTracker(opts.config.budgets.maxUsdPerRun);
  const timeoutMs = opts.config.budgets.stageTimeoutSec * 1000;
  const skill = (name: string) => join(opts.factoryRoot, "skills", name);
  const stageLog: Record<string, StageResult> = {};
  let revisions: RevisionOutcome | undefined;

  const writeManifest = (phase: RunPhase) =>
    writeJson(join(runDir, "run.json"), {
      brief: opts.briefPath,
      factoryCommit: opts.factoryCommit,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      phase,
      costUsd: costs.spent(),
      budgetUsd: opts.config.budgets.maxUsdPerRun,
      models: opts.config.stages,
      stages: stageLog,
      revisions,
    });

  log(`Run directory: ${runDir}`);
  log("Planner: splitting brief into sub-questions");
  const planner = await runStage({
    name: "planner",
    stage: opts.config.stages.planner,
    invocation: {
      cwd: runDir,
      skillDir: skill("planner"),
      extensions: [],
      tools: PLANNER_TOOLS,
      prompt: "Use the planner skill. Read brief.md in the current directory and write backlog.md.",
      sessionDir: join(runDir, "sessions"),
      timeoutMs,
    },
    runner: opts.runner,
    costs,
    validate: () => validatePlanner(runDir),
  });
  stageLog.planner = planner;
  if (!planner.ok) {
    log(`Planner failed: ${planner.error}`);
    writeManifest("planner-failed");
    return { runDir, phase: "planner-failed", costUsd: costs.spent(), questions: [] };
  }

  const ids = parseBacklogIds(readFileSync(join(runDir, "backlog.md"), "utf8"));
  log(`Research: ${ids.length} sub-questions, ${opts.config.budgets.maxParallelResearchers} in parallel`);
  const questions = await mapWithConcurrency(ids, opts.config.budgets.maxParallelResearchers, async (qid) => {
    let attempt = 0;
    const outcome = await researchQuestion(qid, {
      maxRepairRounds: opts.config.budgets.maxRepairRounds,
      verify: () => opts.verifyQuestion(runDir, qid),
      runResearcher: async (prompt) => {
        const result = await runStage({
          name: `researcher-${qid}`,
          stage: opts.config.stages.researcher,
          invocation: {
            cwd: runDir,
            skillDir: skill("researcher"),
            extensions: [join(opts.factoryRoot, "extensions", "web-tools")],
            tools: RESEARCHER_TOOLS,
            prompt,
            sessionDir: join(runDir, "sessions"),
            timeoutMs,
          },
          runner: opts.runner,
          costs,
          validate: () => validateResearcher(runDir, qid),
        });
        stageLog[`researcher-${qid}-${attempt++}`] = result;
        return result;
      },
    });
    log(`  ${qid}: ${outcome.status}${outcome.repairRounds ? ` after ${outcome.repairRounds} repair round(s)` : ""}`);
    return outcome;
  });

  writeJson(join(runDir, "research-status.json"), { questions });
  log(`Research complete. Cost so far: $${costs.spent().toFixed(4)}`);
  const finish = (phase: RunPhase): RunResult => {
    writeManifest(phase);
    return { runDir, phase, costUsd: costs.spent(), questions };
  };
  if (questions.every((q) => q.status === "excluded")) {
    log("Every sub-question was excluded; nothing to synthesize");
    return finish("research-failed");
  }

  /** A stage that reads run files and writes one output file, checked by `validate`. */
  const runWriter = async (
    name: "synthesizer" | "solution-generator" | "red-team" | "proposal-writer" | "evaluator",
    prompt: string,
    validate: () => string | null,
    sessionDir = join(runDir, "sessions"),
  ) => {
    const result = await runStage({
      name,
      stage: opts.config.stages[name],
      invocation: {
        cwd: runDir,
        skillDir: skill(name),
        extensions: [],
        tools: WRITER_TOOLS,
        prompt,
        sessionDir,
        timeoutMs,
      },
      runner: opts.runner,
      costs,
      validate,
    });
    stageLog[name] = result;
    if (!result.ok) log(`${name} failed: ${result.error}`);
    return result.ok;
  };

  log("Synthesizer: merging verified notes into findings.md");
  const synthesized = await runWriter(
    "synthesizer",
    "Use the synthesizer skill. Read brief.md, research-status.json and the notes in notes/, " +
      "then write findings.md in the current directory.",
    () => checkFindingsCitations(runDir),
  );
  if (!synthesized) return finish("synthesizer-failed");

  log("Solution generator: scoring options in options.md");
  const generated = await runWriter(
    "solution-generator",
    "Use the solution-generator skill. Read brief.md and findings.md in the current directory and write options.md.",
    () => checkOptions(runDir),
  );
  if (!generated) return finish("solution-generator-failed");

  log("Red team: critiquing options in critique.md");
  const critiqued = await runWriter(
    "red-team",
    "Use the red-team skill. Read brief.md, findings.md and options.md in the current directory and write critique.md.",
    () => checkCritique(runDir),
  );
  if (!critiqued) return finish("red-team-failed");

  log("Proposal: drafting, evaluating and revising proposal.md");
  revisions = await reviseUntilAccepted({
    runDir,
    maxRevisionRounds: opts.config.budgets.maxRevisionRounds,
    minEvalScore: opts.config.thresholds.minEvalScore,
    writeProposal: (round) =>
      runWriter(
        "proposal-writer",
        round === 0
          ? "Use the proposal-writer skill. Read brief.md, findings.md, options.md and critique.md in the " +
              "current directory and write proposal.md."
          : "Use the proposal-writer skill. This is a revision: read eval.json, proposal.md, brief.md, findings.md, " +
              "options.md and critique.md in the current directory and revise proposal.md.",
        () => checkProposal(runDir),
      ),
    evaluate: () =>
      runWriter(
        "evaluator",
        buildEvaluatorPrompt(opts.rubric),
        () => checkEval(runDir, opts.rubric.criteria, opts.rubric.personas.length),
        // The session log holds the rubric, so it stays out of the run directory writers can read.
        join(opts.runsDir, ".evaluator-sessions", basename(runDir)),
      ),
    log,
  });
  const phases = {
    "writer-failed": "proposal-writer-failed",
    "evaluator-failed": "evaluator-failed",
    "below-threshold": "below-threshold",
    accepted: "proposal-accepted",
  } as const satisfies Record<RevisionOutcome["status"], RunPhase>;
  return finish(phases[revisions.status]);
}
