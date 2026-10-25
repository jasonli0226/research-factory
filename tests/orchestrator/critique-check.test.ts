import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkCritique } from "../../orchestrator/src/critique-check.js";

const FINDINGS = "## Summary\nSimulation suffers from limited accuracy at scale [Q5.S4]. Trees win [Q3.S1].\n";
const OPTIONS = ["A", "B", "C"].map((l) => `## Option ${l}: Name ${l}\n\nClaim [Q3.S1].\n`).join("\n");

const section = (letter: string, objections = "1. **Weak evidence** (minor): thin [Q3.S1].\n   Resolves it: a benchmark\n") =>
  `## Option ${letter}: Name ${letter}\n\n### Score challenges\n\n### Objections\n${objections}\n### Unconfirmed figures\n`;

function setupRun(critique: string | null) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-critique-"));
  writeFileSync(join(runDir, "brief.md"), "# Brief\nSensing hardware is out of scope for this work.\n");
  writeFileSync(join(runDir, "findings.md"), FINDINGS);
  writeFileSync(join(runDir, "options.md"), OPTIONS);
  if (critique !== null) writeFileSync(join(runDir, "critique.md"), critique);
  return runDir;
}

const critique = (...sections: string[]) => ["# Critique", ...sections].join("\n");
const valid = (c = section("C")) => critique(section("A"), section("B"), c);

describe("checkCritique", () => {
  it("accepts a section per option with tagged objections and known markers", () => {
    expect(checkCritique(setupRun(valid()))).toBeNull();
  });

  it("rejects a missing critique.md", () => {
    expect(checkCritique(setupRun(null))).toMatch(/critique\.md/);
  });

  it("rejects a critique that skips an option", () => {
    expect(checkCritique(setupRun(critique(section("A"), section("C"))))).toBe("critique.md has no section for Option B");
  });

  it("rejects a marker that findings.md does not cite", () => {
    const c = section("C", "1. **Bad** (minor): claim [Q9.S9].\n");

    expect(checkCritique(setupRun(valid(c)))).toBe("Unknown marker: [Q9.S9]");
  });

  it("accepts all three severity forms, including a tag on the next line", () => {
    const c = section(
      "C",
      "1. **Out of scope**\n   (fatal: Scope): needs sensors.\n" +
        "2. **Wrong target** (major: criterion 1, 5 → 3): queues, not demand [Q3.S1].\n" +
        "3. **Thin** (minor): one benchmark.\n",
    );

    expect(checkCritique(setupRun(valid(c)))).toBeNull();
  });

  it("accepts a tag wrapped across lines and a minor tag with a one-point score change", () => {
    const c = section(
      "C",
      "1. **Wrapped** (major:\n   criterion 2, 4 → 2): claim [Q3.S1].\n" +
        "2. **Small move** (minor: criterion 1, 4 → 3): claim.\n",
    );

    expect(checkCritique(setupRun(valid(c)))).toBeNull();
  });

  it("rejects objections without a well-formed severity tag", () => {
    const c = section(
      "C",
      "1. **No tag**: claim [Q3.S1].\n" +
        "2. **Bare major** (major): claim.\n" +
        "3. **Bare fatal** (fatal): claim.\n",
    );

    expect(checkCritique(setupRun(valid(c)))).toBe(
      "Option C objection 1 has no severity tag; Option C objection 2 has no severity tag; " +
        "Option C objection 3 has no severity tag",
    );
  });

  it("accepts a quote from any input and rejects an edited one", () => {
    const c = section(
      "C",
      '1. **Scope** (minor): the brief says "Sensing hardware is out of scope" and findings say ' +
        '"Simulation suffers from very limited accuracy" [Q5.S4].\n',
    );

    expect(checkCritique(setupRun(valid(c)))).toBe('Quote not in inputs: "Simulation suffers from very limited accuracy"');
  });
});
