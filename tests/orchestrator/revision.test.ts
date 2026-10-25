import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviseUntilAccepted } from "../../orchestrator/src/revision.js";

interface Round {
  readonly score: number;
  readonly mustFix?: number;
}

/**
 * Fake writer and evaluator: round n writes "draft n" to proposal.md and scores it as `rounds[n]`.
 * A round listed in `failWrite` or `failEval` fails that stage instead.
 */
function setup(rounds: Round[], opts: { failWrite?: number[]; failEval?: number[]; maxRevisionRounds?: number } = {}) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-revise-"));
  const seen: { round: number; before: string | null }[] = [];
  let current = -1;
  const deps = {
    runDir,
    maxRevisionRounds: opts.maxRevisionRounds ?? 2,
    minEvalScore: 0.8,
    writeProposal: async (round: number) => {
      const path = join(runDir, "proposal.md");
      seen.push({ round, before: existsSync(path) ? readFileSync(path, "utf8") : null });
      if (opts.failWrite?.includes(round)) return false;
      current = round;
      writeFileSync(path, `draft ${round}`);
      return true;
    },
    evaluate: async () => {
      if (opts.failEval?.includes(current)) return false;
      const r = rounds[current]!;
      const mustFix = Array.from({ length: r.mustFix ?? 0 }, () => ({ section: "s", issue: "i", fix: "f" }));
      writeFileSync(join(runDir, "eval.json"), JSON.stringify({ score: r.score, mustFix }));
      return true;
    },
  };
  return { runDir, deps, seen };
}

const proposalIn = (runDir: string) => readFileSync(join(runDir, "proposal.md"), "utf8");

describe("reviseUntilAccepted", () => {
  it("accepts the first draft when it meets the score and has nothing to fix", async () => {
    const { runDir, deps, seen } = setup([{ score: 0.9 }]);

    const outcome = await reviseUntilAccepted(deps);

    expect(outcome).toEqual({ status: "accepted", bestRound: 0, rounds: [{ round: 0, score: 0.9, mustFix: 0 }] });
    expect(seen.map((s) => s.round)).toEqual([0]);
    expect(readFileSync(join(runDir, "rounds", "proposal.0.md"), "utf8")).toBe("draft 0");
    expect(JSON.parse(readFileSync(join(runDir, "rounds", "eval.0.json"), "utf8")).score).toBe(0.9);
  });

  it("revises until a draft is accepted", async () => {
    const { runDir, deps, seen } = setup([{ score: 0.6 }, { score: 0.85 }]);

    const outcome = await reviseUntilAccepted(deps);

    expect(outcome.status).toBe("accepted");
    expect(outcome.bestRound).toBe(1);
    expect(seen.map((s) => s.round)).toEqual([0, 1]);
    expect(proposalIn(runDir)).toBe("draft 1");
  });

  it("keeps revising while mustFix has items, whatever the score", async () => {
    const { deps } = setup([{ score: 0.95, mustFix: 1 }, { score: 0.9 }]);

    const outcome = await reviseUntilAccepted(deps);

    expect(outcome).toMatchObject({ status: "accepted", bestRound: 1 });
  });

  it("stops after the last revision round and restores the best draft", async () => {
    const { runDir, deps } = setup([{ score: 0.7 }, { score: 0.75 }, { score: 0.6 }]);

    const outcome = await reviseUntilAccepted(deps);

    expect(outcome.status).toBe("below-threshold");
    expect(outcome.bestRound).toBe(1);
    expect(outcome.rounds.map((r) => r.score)).toEqual([0.7, 0.75, 0.6]);
    expect(proposalIn(runDir)).toBe("draft 1");
    expect(JSON.parse(readFileSync(join(runDir, "eval.json"), "utf8")).score).toBe(0.75);
  });

  it("prefers a draft with fewer mustFix items over a higher score", async () => {
    const { deps } = setup([{ score: 0.9, mustFix: 2 }, { score: 0.7 }], { maxRevisionRounds: 1 });

    expect((await reviseUntilAccepted(deps)).bestRound).toBe(1);
  });

  it("revises from the best draft so far, not the latest", async () => {
    const { deps, seen } = setup([{ score: 0.7 }, { score: 0.5 }, { score: 0.9 }]);

    await reviseUntilAccepted(deps);

    expect(seen[2]).toEqual({ round: 2, before: "draft 0" });
  });

  it("reports a failed first draft", async () => {
    const { deps } = setup([], { failWrite: [0] });

    expect(await reviseUntilAccepted(deps)).toEqual({ status: "writer-failed", rounds: [] });
  });

  it("reports a failed first evaluation", async () => {
    const { deps } = setup([{ score: 0.9 }], { failEval: [0] });

    expect(await reviseUntilAccepted(deps)).toEqual({ status: "evaluator-failed", rounds: [] });
  });

  it("keeps the best draft when a revision fails", async () => {
    const { runDir, deps } = setup([{ score: 0.7 }, { score: 0.9 }], { failWrite: [1] });

    const outcome = await reviseUntilAccepted(deps);

    expect(outcome).toMatchObject({ status: "below-threshold", bestRound: 0 });
    expect(proposalIn(runDir)).toBe("draft 0");
  });
});
