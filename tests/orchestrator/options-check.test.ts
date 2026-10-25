import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkOptions } from "../../orchestrator/src/options-check.js";

const FINDINGS = `# Findings
## Summary
Simulation relies on oversimplified assumptions and thus suffers from limited accuracy [Q5.S4].
Trees beat the naive profile [Q3.S1][Q3.S2].
`;

const option = (letter: string, body = "Trees beat the profile [Q3.S1].") =>
  `## Option ${letter}: Name ${letter}\n\n**Design:** x\n\n**Evidence:** ${body}\n`;

const COMPARISON = "## Comparison\n\n| Option | 1 |\n|---|---|\n| A | 4 |\n";

function setupRun(options: string | null) {
  const runDir = mkdtempSync(join(tmpdir(), "rf-options-"));
  writeFileSync(join(runDir, "findings.md"), FINDINGS);
  if (options !== null) writeFileSync(join(runDir, "options.md"), options);
  return runDir;
}

const valid = (...extra: string[]) => ["# Options", option("A"), option("B"), option("C"), ...extra, COMPARISON].join("\n");

describe("checkOptions", () => {
  it("accepts three options with known markers and a comparison table", () => {
    expect(checkOptions(setupRun(valid()))).toBeNull();
  });

  it("rejects a missing options.md", () => {
    expect(checkOptions(setupRun(null))).toMatch(/options\.md/);
  });

  it("rejects fewer than three options", () => {
    const options = ["# Options", option("A"), option("B"), COMPARISON].join("\n");

    expect(checkOptions(setupRun(options))).toBe("options.md has 2 options; need at least 3");
  });

  it("rejects options.md without a comparison section", () => {
    const options = ["# Options", option("A"), option("B"), option("C")].join("\n");

    expect(checkOptions(setupRun(options))).toBe("options.md has no ## Comparison section");
  });

  it("rejects a marker that findings.md does not cite", () => {
    expect(checkOptions(setupRun(valid(option("D", "Claim [Q3.S9]."))))).toBe("Unknown marker: [Q3.S9]");
  });

  it("accepts a quote copied word for word, across a line break", () => {
    const quote = 'Simulation "relies on oversimplified assumptions and\nthus suffers from limited accuracy" [Q5.S4].';

    expect(checkOptions(setupRun(valid(option("D", quote))))).toBeNull();
  });

  it("rejects an edited quote, straight or curly", () => {
    const straight = 'It "requires extensive calibration and rel[ies] on assumptions" [Q5.S4].';
    const curly = "It “suffers from very limited accuracy” [Q5.S4].";

    expect(checkOptions(setupRun(valid(option("D", straight), option("E", curly))))).toBe(
      'Quote not in findings.md: "requires extensive calibration and rel[ies] on assumptions"; ' +
        'Quote not in findings.md: "suffers from very limited accuracy"',
    );
  });

  it("ignores short quoted terms", () => {
    expect(checkOptions(setupRun(valid(option("D", 'A "what-if" view [Q5.S4].'))))).toBeNull();
  });
});
