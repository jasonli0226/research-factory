import { describe, expect, it } from "vitest";
import { createCostTracker } from "../../orchestrator/src/budget.js";
import type { PiInvocation, PiResult } from "../../orchestrator/src/pi-runner.js";
import { runStage } from "../../orchestrator/src/stage.js";

const base = { cwd: "/r", skillDir: "/s", extensions: [], tools: ["read"], prompt: "p", sessionDir: "/r/s", timeoutMs: 1 };
const stageConfig = {
  provider: "openrouter",
  model: "primary",
  fallback: { provider: "openrouter", model: "backup" },
};
const ok = (cost = 0.01): PiResult => ({ ok: true, costUsd: cost, finalText: "done" });
const fail = (error: string): PiResult => ({ ok: false, costUsd: 0, finalText: "", error });

function scriptedRunner(results: PiResult[]) {
  const calls: PiInvocation[] = [];
  return {
    calls,
    runner: async (inv: PiInvocation) => {
      calls.push(inv);
      const next = results.shift();
      if (!next) throw new Error("no more scripted results");
      return next;
    },
  };
}

describe("runStage", () => {
  it("succeeds on the first attempt with the primary model", async () => {
    const { runner, calls } = scriptedRunner([ok(0.05)]);
    const costs = createCostTracker(1);
    const result = await runStage({ name: "planner", stage: stageConfig, invocation: base, runner, costs, validate: () => null });
    expect(result).toMatchObject({ ok: true, model: "primary" });
    expect(result.attempts).toHaveLength(1);
    expect(calls[0]?.model).toBe("primary");
    expect(costs.spent()).toBeCloseTo(0.05);
  });

  it("retries the primary once, then switches to the fallback model", async () => {
    const { runner, calls } = scriptedRunner([fail("403"), fail("timeout"), ok()]);
    const result = await runStage({
      name: "planner", stage: stageConfig, invocation: base, runner, costs: createCostTracker(1), validate: () => null,
    });
    expect(calls.map((c) => c.model)).toEqual(["primary", "primary", "backup"]);
    expect(result).toMatchObject({ ok: true, model: "backup" });
  });

  it("treats missing or invalid output as a failed attempt", async () => {
    const { runner } = scriptedRunner([ok(), ok(), ok()]);
    let checks = 0;
    const validate = () => (++checks < 3 ? "backlog.md missing" : null);
    const result = await runStage({ name: "planner", stage: stageConfig, invocation: base, runner, costs: createCostTracker(1), validate });
    expect(result.ok).toBe(true);
    expect(result.attempts.map((a) => a.error ?? "ok")).toEqual(["backlog.md missing", "backlog.md missing", "ok"]);
  });

  it("tells the next attempt why the previous output failed its check", async () => {
    const { runner, calls } = scriptedRunner([ok(), ok(), ok()]);
    const errors = ["Malformed marker: [Q1 (Gaps)]", "Unknown marker: [Q9.S9]", null];
    const validate = () => errors.shift() ?? null;
    await runStage({ name: "writer", stage: stageConfig, invocation: base, runner, costs: createCostTracker(1), validate });

    expect(calls[0]!.prompt).toBe("p");
    expect(calls[1]!.prompt).toMatch(/^p\n\n/);
    expect(calls[1]!.prompt).toContain("Malformed marker: [Q1 (Gaps)]");
    expect(calls[2]!.prompt).toContain("Unknown marker: [Q9.S9]");
    expect(calls[2]!.prompt).not.toContain("[Q1 (Gaps)]");
  });

  it("retries a provider error with the original prompt", async () => {
    const { runner, calls } = scriptedRunner([fail("403"), ok()]);
    await runStage({
      name: "planner", stage: stageConfig, invocation: base, runner, costs: createCostTracker(1), validate: () => null,
    });

    expect(calls[1]!.prompt).toBe("p");
  });

  it("fails after all attempts without a fallback", async () => {
    const { runner } = scriptedRunner([fail("a"), fail("b")]);
    const result = await runStage({
      name: "planner", stage: { provider: "p", model: "only" }, invocation: base, runner, costs: createCostTracker(1),
      validate: () => null,
    });
    expect(result).toMatchObject({ ok: false, error: "b" });
    expect(result.attempts).toHaveLength(2);
  });

  it("refuses to start when the budget is spent", async () => {
    const { runner, calls } = scriptedRunner([ok()]);
    const costs = createCostTracker(0.1);
    costs.add(0.1);
    const result = await runStage({ name: "planner", stage: stageConfig, invocation: base, runner, costs, validate: () => null });
    expect(result).toMatchObject({ ok: false, error: "Budget exhausted" });
    expect(calls).toHaveLength(0);
  });

  it("turns a runner exception into a failed attempt", async () => {
    const runner = async () => {
      throw new Error("spawn pi ENOENT");
    };
    const result = await runStage({
      name: "planner", stage: { provider: "p", model: "m" }, invocation: base, runner, costs: createCostTracker(1),
      validate: () => null,
    });
    expect(result).toMatchObject({ ok: false, error: "spawn pi ENOENT" });
  });
});
