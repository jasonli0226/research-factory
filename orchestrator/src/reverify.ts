import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QuestionReport } from "../../verifier/src/verify.js";
import { classifyQuestion, type QuestionOutcome } from "./research.js";

export interface ReverifyResult {
  readonly questions: QuestionOutcome[];
}

/**
 * Re-judge an existing run with the current verifier, without model calls.
 * Questions whose researcher never wrote notes keep their old outcome.
 */
export async function reverifyRun(
  runDir: string,
  verifyQuestion: (qid: string) => Promise<QuestionReport>,
): Promise<ReverifyResult> {
  const statusPath = join(runDir, "research-status.json");
  if (!existsSync(statusPath)) throw new Error(`No research-status.json in ${runDir}`);
  const previous = (JSON.parse(readFileSync(statusPath, "utf8")) as { questions: QuestionOutcome[] }).questions;

  const questions: QuestionOutcome[] = [];
  for (const old of previous) {
    if (!existsSync(join(runDir, "notes", `${old.id}.sources.json`))) {
      questions.push(old);
      continue;
    }
    const report = await verifyQuestion(old.id);
    const { status, droppedSourceIds, reason } = classifyQuestion(report);
    questions.push({
      id: old.id,
      status,
      repairRounds: old.repairRounds,
      droppedSourceIds,
      verifiedRatio: report.ratio,
      ...(reason ? { reason } : {}),
    });
  }

  writeFileSync(statusPath, `${JSON.stringify({ questions }, null, 2)}\n`);
  return { questions };
}
