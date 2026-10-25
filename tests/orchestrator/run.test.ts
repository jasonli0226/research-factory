import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConfig } from "../../orchestrator/src/config.js";
import type { PiInvocation, PiResult } from "../../orchestrator/src/pi-runner.js";
import type { Rubric } from "../../orchestrator/src/rubric.js";
import { localDate, runFactory, slugify } from "../../orchestrator/src/run.js";
import type { QuestionReport } from "../../verifier/src/verify.js";

const stage = { provider: "p", model: "m" };
const evaluator = { provider: "p", model: "judge/m", crossFamily: { provider: "p", model: "cross/m" } };
const config = parseConfig({
  stages: {
    planner: stage, researcher: stage, synthesizer: stage, "solution-generator": stage,
    "red-team": stage, "proposal-writer": stage, evaluator,
  },
  budgets: { maxRevisionRounds: 1, maxRepairRounds: 1, maxParallelResearchers: 2, maxUsdPerRun: 1, stageTimeoutSec: 60 },
  thresholds: { minEvalScore: 0.8, minVerifiedCitationRatio: 1 },
});

function setup() {
  const root = mkdtempSync(join(tmpdir(), "rf-run-"));
  const brief = join(root, "llm-adaptation.brief.md");
  writeFileSync(brief, "# Research Brief\n## Question\nWhat?\n");
  mkdirSync(join(root, "runs"));
  return { root, brief, runsDir: join(root, "runs") };
}

const SOURCES = JSON.stringify([{ id: "S1", url: "https://a", quote: "q", claim: "c" }]);

/**
 * Fake pi: the planner writes a backlog, the researcher writes notes for the question in its prompt,
 * the synthesizer writes the given findings, the solution generator writes the given options,
 * the red team writes the given critique, the proposal writer writes the given proposal,
 * the evaluator writes the given evaluations in turn, repeating the last one.
 */
const OPTIONS = ["A", "B", "C"].map((l) => `## Option ${l}: x\nClaim [Q1.S1].\n`).join("\n") + "## Comparison\n";

const CRITIQUE = ["A", "B", "C"]
  .map((l) => `## Option ${l}: x\n### Objections\n1. **Thin** (minor): one study [Q1.S1].\n`)
  .join("\n");

const PROPOSAL = [
  "## Recommendation\nAdopt Option A [Q1.S1].",
  "## Why this option\nIt fits.",
  "## Options not chosen\n- Option B: costs more.",
  "## Risks and open objections\n- Thin evidence (no published evidence).",
  "## What would change this decision\n- A failed benchmark.",
  "## First steps\n1. Build the evaluation set.",
].join("\n\n");

const RUBRIC: Rubric = {
  text: "# Rubric\n## C1: Secret criterion only the evaluator sees (weight 1)\n",
  criteria: [{ id: "C1", weight: 1 }],
  personas: ["# Decider\nDecides.\n"],
};

const EVAL = JSON.stringify({
  score: 0.9,
  perCriterion: [{ id: "C1", score: 0.9, reason: "fine" }],
  mustFix: [],
  personaFeedback: [{ persona: "Decider", feedback: "ok" }, { persona: "Team", feedback: "ok" }],
});

function fakeRunner(
  costPerCall = 0.01,
  findings = "## Summary\nA [Q1.S1].\n",
  options = OPTIONS,
  critique = CRITIQUE,
  proposal = PROPOSAL,
  evaluations = [EVAL],
) {
  const calls: PiInvocation[] = [];
  const runner = async (inv: PiInvocation): Promise<PiResult> => {
    calls.push(inv);
    const skill = basename(inv.skillDir);
    if (skill === "planner") writeFileSync(join(inv.cwd, "backlog.md"), "# Backlog\n## Q1: a\n## Q2: b\n");
    if (skill === "researcher") {
      const qid = /\b(Q\d+)\b/.exec(inv.prompt)![1]!;
      writeFileSync(join(inv.cwd, "notes", `${qid}.md`), "x [S1]");
      writeFileSync(join(inv.cwd, "notes", `${qid}.sources.json`), SOURCES);
    }
    if (skill === "synthesizer") writeFileSync(join(inv.cwd, "findings.md"), findings);
    if (skill === "solution-generator") writeFileSync(join(inv.cwd, "options.md"), options);
    if (skill === "red-team") writeFileSync(join(inv.cwd, "critique.md"), critique);
    if (skill === "proposal-writer") writeFileSync(join(inv.cwd, "proposal.md"), proposal);
    if (skill === "evaluator") {
      const done = calls.filter((c) => basename(c.skillDir) === "evaluator").length;
      writeFileSync(join(inv.cwd, "eval.json"), evaluations[Math.min(done, evaluations.length) - 1]!);
    }
    return { ok: true, costUsd: costPerCall, finalText: "done" };
  };
  return { runner, calls };
}

const verified: QuestionReport = {
  passed: true, ratio: 1, errors: [], markers: { missing: [], unused: [] },
  results: [{ id: "S1", url: "https://a", status: "exact" }],
};
const failing: QuestionReport = {
  passed: false, ratio: 0, errors: [], markers: { missing: [], unused: [] },
  results: [{ id: "S1", url: "https://a", status: "not_found" }],
};

describe("localDate", () => {
  it("uses the local calendar date, not UTC", () => {
    const d = new Date(2026, 9, 13, 0, 30); // 00:30 local time on 13 Oct
    expect(localDate(d)).toBe("2026-10-13");
  });
});

describe("slugify", () => {
  it("makes a short filesystem-safe name", () => {
    expect(slugify("LLM Adaptation (v2).brief")).toBe("llm-adaptation-v2-brief");
  });
});

describe("runFactory", () => {
  it("plans, researches, verifies, synthesizes, generates and critiques options, writes and evaluates the proposal, and records the outcome", async () => {
    const { brief, runsDir } = setup();
    const { runner, calls } = fakeRunner();
    const result = await runFactory({
      briefPath: brief,
      runsDir,
      factoryRoot: "/factory",
      factoryCommit: "abc123",
      config,
      rubric: RUBRIC,
      runner,
      verifyQuestion: async (_runDir, qid) => (qid === "Q1" ? verified : failing),
      now: new Date(2026, 9, 13, 10),
    });

    expect(basename(result.runDir)).toBe("2026-10-13-llm-adaptation");
    expect(readFileSync(join(result.runDir, "brief.md"), "utf8")).toContain("What?");
    // planner + Q1 research + Q2 research + Q2 one repair + synthesizer + solution generator + red team
    // + proposal writer + evaluator
    expect(calls.map((c) => basename(c.skillDir))).toEqual([
      "planner", "researcher", "researcher", "researcher", "synthesizer", "solution-generator", "red-team",
      "proposal-writer", "evaluator",
    ]);
    expect(calls[1]?.extensions).toEqual(["/factory/extensions/web-tools"]);
    expect(calls[4]).toMatchObject({ extensions: [], tools: ["read", "write"] });
    expect(readFileSync(join(result.runDir, "findings.md"), "utf8")).toContain("[Q1.S1]");
    expect(calls[5]).toMatchObject({ extensions: [], tools: ["read", "write"] });
    expect(existsSync(join(result.runDir, "options.md"))).toBe(true);
    expect(calls[6]).toMatchObject({ extensions: [], tools: ["read", "write"] });
    expect(existsSync(join(result.runDir, "critique.md"))).toBe(true);
    expect(calls[7]).toMatchObject({ extensions: [], tools: ["read", "write"] });
    expect(existsSync(join(result.runDir, "proposal.md"))).toBe(true);
    expect(calls[8]).toMatchObject({ extensions: [], tools: ["read", "write"] });
    expect(calls[8]!.prompt).toContain("<rubric>");
    expect(calls[8]!.sessionDir.startsWith(result.runDir)).toBe(false);
    expect(existsSync(join(result.runDir, "eval.json"))).toBe(true);
    const runFiles = readdirSync(result.runDir, { recursive: true, withFileTypes: true }).filter((f) => f.isFile());
    for (const f of runFiles) {
      expect(readFileSync(join(f.parentPath, f.name), "utf8")).not.toContain("Secret criterion");
    }

    const status = JSON.parse(readFileSync(join(result.runDir, "research-status.json"), "utf8"));
    expect(status.questions.map((q: { id: string; status: string }) => [q.id, q.status])).toEqual([
      ["Q1", "verified"],
      ["Q2", "excluded"],
    ]);

    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest).toMatchObject({ factoryCommit: "abc123", phase: "proposal-accepted" });
    expect(manifest.stages.synthesizer).toMatchObject({ ok: true });
    expect(manifest.stages["solution-generator"]).toMatchObject({ ok: true });
    expect(manifest.stages["red-team"]).toMatchObject({ ok: true });
    expect(manifest.stages["proposal-writer"]).toMatchObject({ ok: true });
    expect(manifest.stages.evaluator).toMatchObject({ ok: true });
    expect(manifest.revisions).toEqual({
      status: "accepted", bestRound: 0, rounds: [{ round: 0, score: 0.9, mustFix: 0 }],
    });
    expect(manifest.costUsd).toBeCloseTo(0.09);
  });

  it("fails the synthesizer stage when findings cite a source the verifier excluded", async () => {
    const { brief, runsDir } = setup();
    const { runner, calls } = fakeRunner(0.01, "## Summary\nA [Q1.S1]. B [Q2.S1].\n");
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async (_runDir, qid) => (qid === "Q1" ? verified : failing), now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("synthesizer-failed");
    expect(calls.some((c) => basename(c.skillDir) === "solution-generator")).toBe(false);
    // primary model and one retry; the test config has no fallback
    expect(calls.filter((c) => basename(c.skillDir) === "synthesizer")).toHaveLength(2);
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.stages.synthesizer).toMatchObject({ ok: false, error: "Excluded question: [Q2.S1]" });
  });

  it("fails the solution-generator stage when options misquote the findings", async () => {
    const { brief, runsDir } = setup();
    const misquoted = OPTIONS.replace("Claim [Q1.S1].", 'It "is the best method by far" [Q1.S1].');
    const { runner, calls } = fakeRunner(0.01, undefined, misquoted);
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("solution-generator-failed");
    expect(calls.filter((c) => basename(c.skillDir) === "solution-generator")).toHaveLength(2);
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.stages["solution-generator"]).toMatchObject({
      ok: false, error: 'Quote not in findings.md: "is the best method by far"',
    });
  });

  it("fails the red-team stage when the critique skips an option", async () => {
    const { brief, runsDir } = setup();
    const { runner, calls } = fakeRunner(0.01, undefined, undefined, CRITIQUE.replace("## Option B", "## Notes"));
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("red-team-failed");
    expect(calls.filter((c) => basename(c.skillDir) === "red-team")).toHaveLength(2);
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.stages["red-team"]).toMatchObject({ ok: false, error: "critique.md has no section for Option B" });
  });

  it("fails the proposal-writer stage when the proposal cites a bare question number", async () => {
    const { brief, runsDir } = setup();
    const bare = PROPOSAL.replace("Thin evidence (no published evidence).", "Thin evidence [Q1].");
    const { runner, calls } = fakeRunner(0.01, undefined, undefined, undefined, bare);
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("proposal-writer-failed");
    expect(calls.filter((c) => basename(c.skillDir) === "proposal-writer")).toHaveLength(2);
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.stages["proposal-writer"]).toMatchObject({ ok: false });
    expect(manifest.stages["proposal-writer"].error).toMatch(/^Malformed marker: \[Q1\]\. Cite a source as/);
    expect(calls.filter((c) => basename(c.skillDir) === "proposal-writer")[1]!.prompt).toContain(
      "failed this check:\nMalformed marker: [Q1]",
    );
  });

  it("fails the evaluator stage when eval.json misses a rubric criterion", async () => {
    const { brief, runsDir } = setup();
    const partial = JSON.stringify({ ...JSON.parse(EVAL), perCriterion: [] });
    const { runner, calls } = fakeRunner(0.01, undefined, undefined, undefined, undefined, [partial]);
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("evaluator-failed");
    // primary twice, then the cross-family model, which is outside the writer's family too
    expect(calls.filter((c) => basename(c.skillDir) === "evaluator").map((c) => c.model)).toEqual([
      "judge/m", "judge/m", "cross/m",
    ]);
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.stages.evaluator).toMatchObject({ ok: false, error: "eval.json has no score for C1" });
  });

  it("revises the proposal from eval.json until it is accepted", async () => {
    const { brief, runsDir } = setup();
    const low = JSON.stringify({ ...JSON.parse(EVAL), score: 0.5, perCriterion: [{ id: "C1", score: 0.5, reason: "x" }] });
    const { runner, calls } = fakeRunner(0.01, undefined, undefined, undefined, undefined, [low, EVAL]);
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("proposal-accepted");
    const writers = calls.filter((c) => basename(c.skillDir) === "proposal-writer");
    expect(writers).toHaveLength(2);
    expect(writers[0]!.prompt).not.toContain("eval.json");
    expect(writers[1]!.prompt).toContain("eval.json");
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.revisions).toMatchObject({ status: "accepted", bestRound: 1 });
    expect(existsSync(join(result.runDir, "rounds", "proposal.1.md"))).toBe(true);
  });

  it("ends below threshold with the best draft after the last revision round", async () => {
    const { brief, runsDir } = setup();
    const low = JSON.stringify({ ...JSON.parse(EVAL), score: 0.5, perCriterion: [{ id: "C1", score: 0.5, reason: "x" }] });
    const { runner } = fakeRunner(0.01, undefined, undefined, undefined, undefined, [low]);
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    // the test config allows one revision round
    expect(result.phase).toBe("below-threshold");
    const manifest = JSON.parse(readFileSync(join(result.runDir, "run.json"), "utf8"));
    expect(manifest.revisions.rounds).toHaveLength(2);
  });

  it("evaluates with another family when the writer fell back to the evaluator's family", async () => {
    const { brief, runsDir } = setup();
    const writer = { ...stage, fallback: { provider: "p", model: "judge/writer" } };
    const fallbackConfig = { ...config, stages: { ...config.stages, "proposal-writer": writer } };
    const { runner: base, calls } = fakeRunner();
    // The primary writer leaves a bare marker, so the stage falls back to the judge family.
    const runner = async (inv: PiInvocation) => {
      const result = await base(inv);
      if (basename(inv.skillDir) === "proposal-writer" && inv.model === "m") {
        writeFileSync(join(inv.cwd, "proposal.md"), PROPOSAL.replace("(no published evidence)", "[Q1]"));
      }
      return result;
    };
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config: fallbackConfig, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("proposal-accepted");
    const models = (skill: string) => calls.filter((c) => basename(c.skillDir) === skill).map((c) => c.model);
    expect(models("proposal-writer")).toEqual(["m", "m", "judge/writer"]);
    expect(models("evaluator")).toEqual(["cross/m"]);
  });

  it("skips the synthesizer when every sub-question is excluded", async () => {
    const { brief, runsDir } = setup();
    const { runner, calls } = fakeRunner();
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => failing, now: new Date(2026, 9, 13, 10),
    });

    expect(result.phase).toBe("research-failed");
    expect(calls.some((c) => basename(c.skillDir) === "synthesizer")).toBe(false);
    expect(existsSync(join(result.runDir, "research-status.json"))).toBe(true);
  });

  it("does not overwrite an existing run directory", async () => {
    const { brief, runsDir } = setup();
    mkdirSync(join(runsDir, "2026-10-13-llm-adaptation"));
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC,
      runner: fakeRunner().runner, verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });
    expect(basename(result.runDir)).toBe("2026-10-13-llm-adaptation-2");
  });

  it("stops when the planner fails", async () => {
    const { brief, runsDir } = setup();
    const runner = async (): Promise<PiResult> => ({ ok: false, costUsd: 0, finalText: "", error: "403" });
    const result = await runFactory({
      briefPath: brief, runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC, runner,
      verifyQuestion: async () => verified, now: new Date(2026, 9, 13, 10),
    });
    expect(result.phase).toBe("planner-failed");
    expect(existsSync(join(result.runDir, "research-status.json"))).toBe(false);
  });

  it("rejects a missing brief", async () => {
    const { runsDir } = setup();
    await expect(
      runFactory({
        briefPath: "/nope/brief.md", runsDir, factoryRoot: "/f", factoryCommit: "c", config, rubric: RUBRIC,
        runner: fakeRunner().runner, verifyQuestion: async () => verified,
      }),
    ).rejects.toThrow(/Brief not found/);
  });
});
