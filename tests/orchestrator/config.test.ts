import { describe, expect, it } from "vitest";
import { parseConfig } from "../../orchestrator/src/config.js";

const stage = { provider: "openrouter", model: "m" };
const valid = {
  stages: {
    planner: { ...stage, fallback: { provider: "openrouter", model: "f" } },
    researcher: stage,
    synthesizer: stage,
    "solution-generator": stage,
    "red-team": stage,
    "proposal-writer": stage,
    evaluator: stage,
  },
  budgets: {
    maxRevisionRounds: 3,
    maxRepairRounds: 2,
    maxParallelResearchers: 4,
    maxUsdPerRun: 2,
    stageTimeoutSec: 900,
  },
  thresholds: { minEvalScore: 0.8, minVerifiedCitationRatio: 1 },
};

describe("parseConfig", () => {
  it("accepts a valid config", () => {
    const config = parseConfig(valid);
    expect(config.stages.planner.fallback?.model).toBe("f");
    expect(config.budgets.maxRepairRounds).toBe(2);
  });

  it("rejects a config missing a stage", () => {
    const { researcher: _omit, ...stages } = valid.stages;
    expect(() => parseConfig({ ...valid, stages })).toThrow(/researcher/);
  });

  it("rejects out-of-range thresholds and budgets", () => {
    expect(() => parseConfig({ ...valid, thresholds: { ...valid.thresholds, minVerifiedCitationRatio: 2 } })).toThrow();
    expect(() => parseConfig({ ...valid, budgets: { ...valid.budgets, maxParallelResearchers: 0 } })).toThrow();
  });
});
