import type { QuestionReport } from "../../verifier/src/verify.js";
import type { StageResult } from "./stage.js";

export type ResearchStatus = "verified" | "partial" | "excluded";

export interface QuestionOutcome {
  readonly id: string;
  readonly status: ResearchStatus;
  readonly repairRounds: number;
  readonly droppedSourceIds: string[];
  readonly verifiedRatio: number;
  readonly reason?: string;
}

export interface ResearchDeps {
  readonly runResearcher: (prompt: string) => Promise<StageResult>;
  readonly verify: () => Promise<QuestionReport>;
  readonly maxRepairRounds: number;
}

export function researcherPrompt(qid: string): string {
  return (
    `Use the researcher skill for sub-question ${qid}. brief.md and backlog.md are in the current directory. ` +
    `Write notes/${qid}.md and notes/${qid}.sources.json.`
  );
}

export function repairPrompt(qid: string, report: QuestionReport): string {
  const failures = report.results
    .filter((r) => r.status === "not_found" || r.status === "fetch_failed")
    .map((r) =>
      r.status === "not_found"
        ? `- ${r.id}: quote not found at ${r.url}`
        : `- ${r.id}: page could not be fetched (${r.error ?? "unknown error"}) at ${r.url}`,
    );
  const problems = [...report.errors.map((e) => `- ${e}`), ...failures];
  return [
    `Use the researcher skill to repair sub-question ${qid}. The citation check failed on notes/${qid}.md and notes/${qid}.sources.json:`,
    ...problems,
    "",
    "For each problem: fetch the page again with web_fetch and copy the quote exactly from its text,",
    "or replace the source with another fetched page that supports the claim,",
    "or remove the source entry and move the claim to Gaps.",
    "Keep ids unique, keep every [Sn] marker matched to a source entry, and rewrite both files in full.",
  ].join("\n");
}

/** Decide what survives: verified sources stay, failed ones and unmatched markers are dropped. */
export function classifyQuestion(
  report: QuestionReport,
): { status: ResearchStatus; droppedSourceIds: string[]; reason?: string } {
  const failed = report.results.filter((r) => r.status === "not_found" || r.status === "fetch_failed").map((r) => r.id);
  const droppedSourceIds = [...new Set([...failed, ...report.markers.missing])];
  const verifiedCount = report.results.length - failed.length;

  if (report.passed) return { status: "verified", droppedSourceIds };
  if (verifiedCount === 0) {
    const reason = report.errors.length > 0 ? report.errors.join("; ") : "No quote could be verified";
    return { status: "excluded", droppedSourceIds, reason };
  }
  return { status: "partial", droppedSourceIds };
}

/** Research one sub-question, then repair it until it passes or the repair budget runs out. */
export async function researchQuestion(qid: string, deps: ResearchDeps): Promise<QuestionOutcome> {
  const first = await deps.runResearcher(researcherPrompt(qid));
  if (!first.ok) {
    return { id: qid, status: "excluded", repairRounds: 0, droppedSourceIds: [], verifiedRatio: 0, reason: `Researcher failed: ${first.error}` };
  }

  let report = await deps.verify();
  let repairRounds = 0;
  while (!report.passed && repairRounds < deps.maxRepairRounds) {
    repairRounds += 1;
    const repair = await deps.runResearcher(repairPrompt(qid, report));
    if (!repair.ok) break;
    report = await deps.verify();
  }

  const { status, droppedSourceIds, reason } = classifyQuestion(report);
  return { id: qid, status, repairRounds, droppedSourceIds, verifiedRatio: report.ratio, ...(reason ? { reason } : {}) };
}
