import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFindingsCitations } from "../../orchestrator/src/findings-check.js";

const source = (id: string) => ({ id, url: `https://example.com/${id}`, quote: "q", claim: "c" });

const questions = [
  { id: "Q1", status: "verified", repairRounds: 0, droppedSourceIds: [], verifiedRatio: 1 },
  { id: "Q2", status: "partial", repairRounds: 1, droppedSourceIds: ["S3"], verifiedRatio: 0.67 },
  { id: "Q3", status: "excluded", repairRounds: 2, droppedSourceIds: ["S1"], verifiedRatio: 0.2, reason: "too few" },
];

function setupRun(findings: string | null) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-findings-"));
  mkdirSync(join(runDir, "notes"));
  writeFileSync(join(runDir, "notes", "Q1.sources.json"), JSON.stringify([source("S1"), source("S2")]));
  writeFileSync(join(runDir, "notes", "Q2.sources.json"), JSON.stringify([source("S1"), source("S2"), source("S3")]));
  writeFileSync(join(runDir, "notes", "Q3.sources.json"), JSON.stringify([source("S1"), source("S2")]));
  writeFileSync(join(runDir, "research-status.json"), JSON.stringify({ questions }));
  if (findings !== null) writeFileSync(join(runDir, "findings.md"), findings);
  return runDir;
}

describe("checkFindingsCitations", () => {
  it("accepts markers that point at kept sources of usable questions", () => {
    const runDir = setupRun("## Summary\nA [Q1.S1][Q1.S2]. B [Q2.S2].\n\n## Gaps\n- nothing on X (Q3)\n");

    expect(checkFindingsCitations(runDir)).toBeNull();
  });

  it("rejects a missing findings.md", () => {
    expect(checkFindingsCitations(setupRun(null))).toMatch(/findings\.md/);
  });

  it("rejects findings with no markers at all", () => {
    expect(checkFindingsCitations(setupRun("## Summary\nUncited claim.\n"))).toMatch(/no \[Qn\.Sm\] markers/);
  });

  it("rejects a source id that does not exist in the question's sources", () => {
    expect(checkFindingsCitations(setupRun("A [Q1.S1]. B [Q1.S7]."))).toBe("Unknown source: [Q1.S7]");
  });

  it("rejects a question id that is not in research-status.json", () => {
    expect(checkFindingsCitations(setupRun("A [Q1.S1]. B [Q9.S1]."))).toBe("Unknown question: [Q9.S1]");
  });

  it("rejects a source the verifier dropped", () => {
    expect(checkFindingsCitations(setupRun("A [Q1.S1]. B [Q2.S3]."))).toBe("Dropped source: [Q2.S3]");
  });

  it("rejects any citation of an excluded question, even its kept sources", () => {
    expect(checkFindingsCitations(setupRun("A [Q1.S1]. B [Q3.S2]."))).toBe("Excluded question: [Q3.S2]");
  });

  it("reports every distinct problem once", () => {
    const result = checkFindingsCitations(setupRun("A [Q1.S7] [Q1.S7]. B [Q2.S3]. C [Q3.S2]."));

    expect(result).toBe("Unknown source: [Q1.S7]; Dropped source: [Q2.S3]; Excluded question: [Q3.S2]");
  });
});
