import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSourcesFile } from "../../verifier/src/sources.js";
import type { QuestionOutcome } from "./research.js";

const MARKER = /\[(Q\d+)\.(S\d+)\]/g;

/**
 * Validate `findings.md` citations against the research results: every `[Qn.Sm]` must name a
 * source that exists, was not dropped, and belongs to a question that was not excluded.
 * Returns an error message, or null when every marker is valid.
 */
export function checkFindingsCitations(runDir: string): string | null {
  const findingsPath = join(runDir, "findings.md");
  if (!existsSync(findingsPath)) return "findings.md was not written";
  const markers = [...new Set([...readFileSync(findingsPath, "utf8").matchAll(MARKER)].map((m) => m[0]))];
  if (markers.length === 0) return "findings.md has no [Qn.Sm] markers";

  const status = JSON.parse(readFileSync(join(runDir, "research-status.json"), "utf8")) as { questions: QuestionOutcome[] };
  const byId = new Map(status.questions.map((q) => [q.id, q]));
  const sourceIds = new Map<string, Set<string>>();
  const sourcesOf = (qid: string) => {
    if (!sourceIds.has(qid)) sourceIds.set(qid, readSourceIds(runDir, qid));
    return sourceIds.get(qid)!;
  };

  const issues = markers.flatMap((marker) => {
    const [, qid, sid] = /\[(Q\d+)\.(S\d+)\]/.exec(marker)!;
    const question = byId.get(qid!);
    if (!question) return [`Unknown question: ${marker}`];
    if (question.status === "excluded") return [`Excluded question: ${marker}`];
    if (!sourcesOf(qid!).has(sid!)) return [`Unknown source: ${marker}`];
    if (question.droppedSourceIds.includes(sid!)) return [`Dropped source: ${marker}`];
    return [];
  });
  return issues.length > 0 ? issues.join("; ") : null;
}

function readSourceIds(runDir: string, qid: string): Set<string> {
  const path = join(runDir, "notes", `${qid}.sources.json`);
  if (!existsSync(path)) return new Set();
  const parsed = parseSourcesFile(readFileSync(path, "utf8"));
  return new Set(parsed.ok ? parsed.sources.map((s) => s.id) : []);
}
