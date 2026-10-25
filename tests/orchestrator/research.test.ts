import { describe, expect, it } from "vitest";
import { classifyQuestion, repairPrompt, researchQuestion } from "../../orchestrator/src/research.js";
import type { StageResult } from "../../orchestrator/src/stage.js";
import type { QuestionReport } from "../../verifier/src/verify.js";

const report = (overrides: Partial<QuestionReport> = {}): QuestionReport => ({
  passed: false,
  ratio: 0,
  errors: [],
  markers: { missing: [], unused: [] },
  results: [],
  ...overrides,
});
const passed = report({ passed: true, ratio: 1, results: [{ id: "S1", url: "https://a", status: "exact" }] });
const oneBad = report({
  ratio: 0.5,
  results: [
    { id: "S1", url: "https://a", status: "exact" },
    { id: "S2", url: "https://b", status: "not_found" },
  ],
  markers: { missing: ["S7"], unused: [] },
});
const stageOk: StageResult = { ok: true, model: "m", attempts: [{ model: "m", costUsd: 0 }] };
const stageFail: StageResult = { ok: false, error: "Budget exhausted", attempts: [] };

describe("classifyQuestion", () => {
  it("marks a passing question verified", () => {
    expect(classifyQuestion(passed)).toEqual({ status: "verified", droppedSourceIds: [] });
  });

  it("keeps verified sources and drops failed ones and missing markers", () => {
    expect(classifyQuestion(oneBad)).toEqual({ status: "partial", droppedSourceIds: ["S2", "S7"] });
  });

  it("excludes a question with no verified sources", () => {
    const none = report({ results: [{ id: "S1", url: "https://a", status: "fetch_failed" }] });
    expect(classifyQuestion(none)).toMatchObject({ status: "excluded" });
    expect(classifyQuestion(report({ errors: ["Invalid JSON: x"] }))).toMatchObject({
      status: "excluded",
      reason: "Invalid JSON: x",
    });
  });
});

describe("repairPrompt", () => {
  it("lists every problem the researcher must fix", () => {
    const prompt = repairPrompt("Q3", { ...oneBad, errors: ["Marker [S7] has no source entry"] });
    expect(prompt).toContain("Q3");
    expect(prompt).toContain("S2: quote not found");
    expect(prompt).toContain("Marker [S7] has no source entry");
    expect(prompt).toMatch(/move the claim to Gaps/i);
  });
});

describe("researchQuestion", () => {
  it("stops after the first passing verification", async () => {
    const prompts: string[] = [];
    const outcome = await researchQuestion("Q1", {
      runResearcher: async (p) => (prompts.push(p), stageOk),
      verify: async () => passed,
      maxRepairRounds: 2,
    });
    expect(outcome).toMatchObject({ id: "Q1", status: "verified", repairRounds: 0 });
    expect(prompts).toHaveLength(1);
  });

  it("repairs until verification passes", async () => {
    const reports = [oneBad, passed];
    const prompts: string[] = [];
    const outcome = await researchQuestion("Q1", {
      runResearcher: async (p) => (prompts.push(p), stageOk),
      verify: async () => reports.shift()!,
      maxRepairRounds: 2,
    });
    expect(outcome).toMatchObject({ status: "verified", repairRounds: 1 });
    expect(prompts[1]).toContain("S2: quote not found");
  });

  it("continues without failed sources after the repair limit", async () => {
    const outcome = await researchQuestion("Q1", {
      runResearcher: async () => stageOk,
      verify: async () => oneBad,
      maxRepairRounds: 2,
    });
    expect(outcome).toMatchObject({ status: "partial", repairRounds: 2, droppedSourceIds: ["S2", "S7"] });
  });

  it("excludes the question when the researcher stage fails", async () => {
    const outcome = await researchQuestion("Q1", {
      runResearcher: async () => stageFail,
      verify: async () => passed,
      maxRepairRounds: 2,
    });
    expect(outcome).toMatchObject({ status: "excluded", reason: "Researcher failed: Budget exhausted" });
  });

  it("keeps the last verification when a repair run fails", async () => {
    const stages = [stageOk, stageFail];
    const outcome = await researchQuestion("Q1", {
      runResearcher: async () => stages.shift()!,
      verify: async () => oneBad,
      maxRepairRounds: 2,
    });
    expect(outcome).toMatchObject({ status: "partial", repairRounds: 1 });
  });
});
