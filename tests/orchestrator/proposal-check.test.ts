import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkProposal } from "../../orchestrator/src/proposal-check.js";

const FINDINGS = "## Summary\nAdapters match full fine-tuning on most tasks tested [Q3.S1]. QLoRA fits one GPU [Q4.S2].\n";
const OPTIONS = ["A", "B", "C"].map((l) => `## Option ${l}: Name ${l}\n\nClaim [Q3.S1].\n`).join("\n");
const CRITIQUE = "# Critique\n## Option A: Name A\n1. **Thin** (minor): one benchmark only.\n";

const REST = [
  "## Why this option\n| 1. Accuracy | 3 | Adapters hold up [Q3.S1] |\n",
  "## Options not chosen\n- **Option B: Name B**: costs more [Q4.S2].\n",
  "## Risks and open objections\n- **Thin** (minor): open (no published evidence)\n",
  "## What would change this decision\n- A failed pilot: switch to Option C.\n",
  "## First steps\n1. Build the evaluation set.\n",
];

const proposal = (recommendation: string, ...extra: string[]) =>
  ["# Proposal: Adapting a model", `## Recommendation\n${recommendation}\n`, ...extra, ...REST].join("\n");

function setupRun(text: string | null) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-proposal-"));
  writeFileSync(join(runDir, "brief.md"), "# Brief\nThe domain data must not leave the team’s own servers.\n");
  writeFileSync(join(runDir, "findings.md"), FINDINGS);
  writeFileSync(join(runDir, "options.md"), OPTIONS);
  writeFileSync(join(runDir, "critique.md"), CRITIQUE);
  if (text !== null) writeFileSync(join(runDir, "proposal.md"), text);
  return runDir;
}

describe("checkProposal", () => {
  it("accepts a proposal that recommends one option with known markers", () => {
    expect(checkProposal(setupRun(proposal("Adopt Option A: Name A, because it is cheapest [Q4.S2].")))).toBeNull();
  });

  it("rejects a missing proposal.md", () => {
    expect(checkProposal(setupRun(null))).toBe("proposal.md was not written");
  });

  it("rejects a proposal without a required section", () => {
    const text = proposal("Adopt Option A.").replace(/## What would change this decision\n[^#]*/, "");

    expect(checkProposal(setupRun(text))).toBe("proposal.md has no ## What would change this decision section");
  });

  it("rejects a recommendation that names no option", () => {
    expect(checkProposal(setupRun(proposal("Build something good.")))).toBe(
      "Recommendation names no option from options.md",
    );
  });

  it("rejects a recommendation that names an option options.md does not have", () => {
    expect(checkProposal(setupRun(proposal("Adopt Option E.")))).toBe("Recommendation names unknown Option E");
  });

  it("rejects a recommendation that names two options without a pilot", () => {
    expect(checkProposal(setupRun(proposal("Adopt Option A or Option C.")))).toBe(
      "Recommendation names Options A, C; name one option or add a ## Pilot section",
    );
  });

  it("accepts a pilot that compares two options", () => {
    const text = proposal("Pilot Option A against Option C.", "## Pilot\n- Options compared: A and C.\n");

    expect(checkProposal(setupRun(text))).toBeNull();
  });

  it("rejects markers that findings.md does not cite", () => {
    expect(checkProposal(setupRun(proposal("Adopt Option A [Q9.S9].")))).toBe("Unknown marker: [Q9.S9]");
  });

  it("rejects bare and malformed markers", () => {
    const text = proposal("Adopt Option A [Q6]. Gaps remain [Q3.10→Q3.S10].");

    expect(checkProposal(setupRun(text))).toBe(
      "Malformed marker: [Q6]; Malformed marker: [Q3.10→Q3.S10]. Cite a source as [Qn.Sm]; " +
        "end a sentence about a gap with (no published evidence) instead",
    );
  });

  it("accepts a quote of one of the proposal's own headings", () => {
    const text = proposal('Adopt Option A; see "What would change this decision" below.');

    expect(checkProposal(setupRun(text))).toBeNull();
  });

  it("accepts a quote from any input and rejects an edited one", () => {
    const text = proposal(
      'Adopt Option A, since "domain data must not leave the team’s own servers" and "adapters match full fine-tuning on every task".',
    );

    expect(checkProposal(setupRun(text))).toBe(
      'Quote not in inputs: "adapters match full fine-tuning on every task"',
    );
  });
});
