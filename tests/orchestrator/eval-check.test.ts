import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkEval } from "../../orchestrator/src/eval-check.js";

const CRITERIA = [
  { id: "C1", weight: 0.6 },
  { id: "C2", weight: 0.4 },
];
const PERSONAS = 2;

const valid = {
  score: 0.8,
  perCriterion: [
    { id: "C1", score: 1, reason: "fine" },
    { id: "C2", score: 0.5, reason: "vague steps" },
  ],
  objections: [],
  constraints: [],
  mustFix: [{ criterion: "C2", section: "First steps", issue: "vague", fix: "name owners" }],
  personaFeedback: [
    { persona: "Decider", feedback: "ok" },
    { persona: "Skeptic", feedback: "ok" },
    { persona: "ML team", feedback: "ok" },
  ],
};

function setupRun(content: string | null) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-eval-"));
  if (content !== null) writeFileSync(join(runDir, "eval.json"), content);
  return runDir;
}

const check = (data: unknown) => checkEval(setupRun(JSON.stringify(data)), CRITERIA, PERSONAS);

describe("checkEval", () => {
  it("accepts a complete evaluation whose score is the weighted sum", () => {
    expect(check(valid)).toBeNull();
  });

  it("rejects a missing eval.json", () => {
    expect(checkEval(setupRun(null), CRITERIA, PERSONAS)).toBe("eval.json was not written");
  });

  it("rejects invalid JSON", () => {
    expect(checkEval(setupRun("{score: 1"), CRITERIA, PERSONAS)).toBe("eval.json is not valid JSON");
  });

  it("rejects a score outside 0-1", () => {
    expect(check({ ...valid, score: 1.2 })).toBe("eval.json score must be a number from 0 to 1");
  });

  it("rejects a missing criterion", () => {
    expect(check({ ...valid, perCriterion: [valid.perCriterion[0]] })).toBe("eval.json has no score for C2");
  });

  it("rejects a criterion score outside 0-1", () => {
    const perCriterion = [valid.perCriterion[0], { id: "C2", score: 2, reason: "x" }];

    expect(check({ ...valid, perCriterion })).toBe("eval.json has no score for C2");
  });

  it("rejects a score that is not the weighted sum of the criteria", () => {
    expect(check({ ...valid, score: 0.95 })).toBe("eval.json score 0.95 does not match the weighted criteria (0.8)");
  });

  it("rejects mustFix items without a section, issue and fix", () => {
    expect(check({ ...valid, mustFix: [{ criterion: "C2", issue: "vague" }] })).toBe(
      "eval.json mustFix item 1 needs section, issue and fix",
    );
  });

  it("rejects feedback missing the audience persona", () => {
    expect(check({ ...valid, personaFeedback: valid.personaFeedback.slice(0, 2) })).toBe(
      "eval.json has 2 persona feedback entries; need 3",
    );
  });
});
