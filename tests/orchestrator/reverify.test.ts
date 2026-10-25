import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reverifyRun } from "../../orchestrator/src/reverify.js";
import type { QuestionReport } from "../../verifier/src/verify.js";

const verified: QuestionReport = {
  passed: true, ratio: 1, errors: [], markers: { missing: [], unused: [] },
  results: [{ id: "S1", url: "https://a", status: "exact" }],
};
const partial: QuestionReport = {
  passed: false, ratio: 0.5, errors: [], markers: { missing: [], unused: [] },
  results: [
    { id: "S1", url: "https://a", status: "exact" },
    { id: "S2", url: "https://b", status: "not_found" },
  ],
};

function setupRun(questions: unknown[], notesFor: string[] = []) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-reverify-"));
  mkdirSync(join(runDir, "notes"));
  for (const qid of notesFor) {
    writeFileSync(join(runDir, "notes", `${qid}.md`), "x [S1]");
    writeFileSync(join(runDir, "notes", `${qid}.sources.json`), "[]");
  }
  writeFileSync(join(runDir, "research-status.json"), JSON.stringify({ questions }));
  return runDir;
}

const readStatus = (runDir: string) =>
  JSON.parse(readFileSync(join(runDir, "research-status.json"), "utf8")) as { questions: Record<string, unknown>[] };

describe("reverifyRun", () => {
  it("re-classifies each question with the current verifier and keeps its repair rounds", async () => {
    const runDir = setupRun([
      { id: "Q1", status: "partial", repairRounds: 2, droppedSourceIds: ["S9"], verifiedRatio: 0.5 },
      { id: "Q2", status: "verified", repairRounds: 0, droppedSourceIds: [], verifiedRatio: 1 },
    ], ["Q1", "Q2"]);
    const checked: string[] = [];

    const result = await reverifyRun(runDir, async (qid) => {
      checked.push(qid);
      return qid === "Q1" ? verified : partial;
    });

    expect(checked).toEqual(["Q1", "Q2"]);
    const expected = [
      { id: "Q1", status: "verified", repairRounds: 2, droppedSourceIds: [], verifiedRatio: 1 },
      { id: "Q2", status: "partial", repairRounds: 0, droppedSourceIds: ["S2"], verifiedRatio: 0.5 },
    ];
    expect(result.questions).toEqual(expected);
    expect(readStatus(runDir).questions).toEqual(expected);
  });

  it("leaves a question untouched when the researcher failed and wrote no notes", async () => {
    const failed = { id: "Q3", status: "excluded", repairRounds: 0, droppedSourceIds: [], verifiedRatio: 0, reason: "Researcher failed: timeout" };
    const runDir = setupRun([failed]);
    const checked: string[] = [];

    const result = await reverifyRun(runDir, async (qid) => {
      checked.push(qid);
      return verified;
    });

    expect(checked).toEqual([]);
    expect(result.questions).toEqual([failed]);
  });

  it("fails clearly when the run has no research-status.json", async () => {
    const runDir = mkdtempSync(join(tmpdir(), "rf-reverify-"));
    await expect(reverifyRun(runDir, async () => verified)).rejects.toThrow(/research-status\.json/);
  });
});
