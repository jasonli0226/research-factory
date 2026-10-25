import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Criterion {
  readonly id: string;
  readonly weight: number;
}

/** The evaluator's hidden inputs: never copied into a run directory. */
export interface Rubric {
  readonly text: string;
  readonly criteria: readonly Criterion[];
  readonly personas: readonly string[];
}

const CRITERION_HEADING = /^## (C\d+):.*\(weight ([\d.]+)\)\s*$/gm;
const WEIGHT_TOLERANCE = 1e-6;

/** Criterion ids and weights from the rubric's `## Cn: ... (weight w)` headings. */
export function parseCriteria(text: string): Criterion[] {
  const criteria = [...text.matchAll(CRITERION_HEADING)].map((m) => ({ id: m[1]!, weight: Number(m[2]) }));
  if (criteria.length === 0) throw new Error("Rubric has no criteria");
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(total - 1) > WEIGHT_TOLERANCE) throw new Error(`Rubric weights sum to ${+total.toFixed(4)}, not 1`);
  return criteria;
}

/** Read `default.md` and every file in `personas/` from a rubrics directory. */
export function loadRubric(rubricsDir: string): Rubric {
  const text = readFileSync(join(rubricsDir, "default.md"), "utf8");
  const personaDir = join(rubricsDir, "personas");
  const personas = readdirSync(personaDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => readFileSync(join(personaDir, f), "utf8"));
  return { text, criteria: parseCriteria(text), personas };
}

/** The evaluator's task prompt, carrying the rubric and personas so they never touch the run directory. */
export function buildEvaluatorPrompt(rubric: Rubric): string {
  return [
    "Use the evaluator skill. Read brief.md, proposal.md, findings.md, options.md and critique.md in the " +
      "current directory and write eval.json.",
    `<rubric>\n${rubric.text}</rubric>`,
    `<personas>\n${rubric.personas.join("\n")}</personas>`,
  ].join("\n\n");
}
