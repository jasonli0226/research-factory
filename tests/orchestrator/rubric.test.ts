import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEvaluatorPrompt, loadRubric, parseCriteria } from "../../orchestrator/src/rubric.js";

const RUBRIC = "# Rubric\n\n## C1: Claims match (weight 0.6)\n- 1: good\n\n## C2: Steps (weight 0.4)\n- 1: good\n";

describe("parseCriteria", () => {
  it("reads each criterion id and weight in order", () => {
    expect(parseCriteria(RUBRIC)).toEqual([
      { id: "C1", weight: 0.6 },
      { id: "C2", weight: 0.4 },
    ]);
  });

  it("rejects a rubric whose weights do not sum to 1", () => {
    expect(() => parseCriteria(RUBRIC.replace("0.4", "0.5"))).toThrow("Rubric weights sum to 1.1, not 1");
  });

  it("rejects a rubric with no criteria", () => {
    expect(() => parseCriteria("# Rubric\n")).toThrow("Rubric has no criteria");
  });
});

describe("loadRubric", () => {
  it("reads the rubric and every persona file, in name order", () => {
    const dir = mkdtempSync(join(tmpdir(), "rf-rubric-"));
    mkdirSync(join(dir, "personas"));
    writeFileSync(join(dir, "default.md"), RUBRIC);
    writeFileSync(join(dir, "personas", "skeptic.md"), "# Skeptic\nDoubts.\n");
    writeFileSync(join(dir, "personas", "decider.md"), "# Decider\nDecides.\n");

    const rubric = loadRubric(dir);

    expect(rubric.text).toBe(RUBRIC);
    expect(rubric.criteria.map((c) => c.id)).toEqual(["C1", "C2"]);
    expect(rubric.personas).toEqual(["# Decider\nDecides.\n", "# Skeptic\nDoubts.\n"]);
  });
});

describe("buildEvaluatorPrompt", () => {
  it("puts the rubric and personas in tagged blocks after the task", () => {
    const prompt = buildEvaluatorPrompt({ text: RUBRIC, criteria: [], personas: ["# Decider\n", "# Skeptic\n"] });

    expect(prompt).toMatch(/^Use the evaluator skill\./);
    expect(prompt).toContain(`<rubric>\n${RUBRIC}</rubric>`);
    expect(prompt).toContain("<personas>\n# Decider\n\n# Skeptic\n</personas>");
  });
});
