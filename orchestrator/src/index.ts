// Orchestrator CLI: research one brief with pi, verifying every citation, then write and evaluate a proposal.
// Usage: npm run factory -- path/to/brief.md
//        npm run factory -- --reverify runs/<run-id>   (re-judge citations only, no model calls)
// Exit code: 0 when the proposal is accepted, 1 when a stage fails or it ends below threshold, 2 on usage or
// config errors.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createFetchText } from "../../verifier/src/fetch-text.js";
import { verifyRun } from "../../verifier/src/verify.js";
import { loadConfig } from "./config.js";
import { createPiRunner } from "./pi-runner.js";
import type { QuestionOutcome } from "./research.js";
import { reverifyRun } from "./reverify.js";
import { loadRubric } from "./rubric.js";
import { runFactory } from "./run.js";

const FACTORY_ROOT = resolve(import.meta.dirname, "../..");

function factoryCommit(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: FACTORY_ROOT, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: FACTORY_ROOT, encoding: "utf8" }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return "unknown";
  }
}

function printQuestions(questions: QuestionOutcome[]): void {
  for (const q of questions.filter((q) => q.status !== "verified")) {
    console.log(`  ${q.id} ${q.status}${q.reason ? `: ${q.reason}` : ""}${q.droppedSourceIds.length ? ` (dropped ${q.droppedSourceIds.join(", ")})` : ""}`);
  }
}

function countStatuses(questions: QuestionOutcome[]): string {
  return ["verified", "partial", "excluded"]
    .map((status) => `${questions.filter((q) => q.status === status).length} ${status}`)
    .join(", ");
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const reverify = args[0] === "--reverify";
  const target = reverify ? args[1] : args[0];
  if (!target) {
    console.error("Usage: npm run factory -- path/to/brief.md\n       npm run factory -- --reverify runs/<run-id>");
    return 2;
  }
  const config = loadConfig(resolve(FACTORY_ROOT, "config/factory.json"));
  const fetchText = createFetchText();
  const minVerifiedRatio = config.thresholds.minVerifiedCitationRatio;

  if (reverify) {
    const runDir = resolve(target);
    const result = await reverifyRun(runDir, async (qid) => {
      const report = await verifyRun(runDir, { fetchText, minVerifiedRatio, questionIds: [qid] });
      return report.questions[qid]!;
    });
    console.log(`Re-verified ${runDir}. Questions: ${countStatuses(result.questions)}`);
    printQuestions(result.questions);
    return 0;
  }

  const result = await runFactory({
    briefPath: resolve(target),
    runsDir: resolve(FACTORY_ROOT, "runs"),
    factoryRoot: FACTORY_ROOT,
    factoryCommit: factoryCommit(),
    config,
    rubric: loadRubric(resolve(FACTORY_ROOT, "rubrics")),
    runner: createPiRunner(),
    verifyQuestion: async (runDir, qid) => {
      const report = await verifyRun(runDir, { fetchText, minVerifiedRatio, questionIds: [qid] });
      return report.questions[qid]!;
    },
    log: (message) => console.log(message),
  });

  console.log(`\nPhase: ${result.phase}. Questions: ${countStatuses(result.questions)}. Cost: $${result.costUsd.toFixed(4)}`);
  printQuestions(result.questions);
  return result.phase === "proposal-accepted" ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`Orchestrator error: ${(err as Error).message}`);
    process.exit(2);
  },
);
