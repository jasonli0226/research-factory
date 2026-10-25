import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findBadQuotes, findUnknownMarkers } from "./text-checks.js";

const OPTION_HEADING = /^## Option ([A-Z])\b/gm;
const SCORE_CHANGE = String.raw`criterion \d+, \d → (?:\d|unknown)`;
const SEVERITY = new RegExp(String.raw`\((?:fatal: [^)]+|major: ${SCORE_CHANGE}|minor(?:: ${SCORE_CHANGE})?)\)`);

/**
 * Validate `critique.md`: a section for every option in options.md, a severity tag on every
 * objection, markers that findings.md cites, and quotations copied word for word from the inputs.
 * Returns an error message, or null when the file is valid.
 */
export function checkCritique(runDir: string): string | null {
  const critiquePath = join(runDir, "critique.md");
  if (!existsSync(critiquePath)) return "critique.md was not written";
  const read = (name: string) => readFileSync(join(runDir, name), "utf8");
  const critique = read("critique.md");
  const findings = read("findings.md");
  const options = read("options.md");

  const covered = new Set([...critique.matchAll(OPTION_HEADING)].map((m) => m[1]));
  const missing = [...options.matchAll(OPTION_HEADING)].map((m) => m[1]).find((l) => !covered.has(l));
  if (missing) return `critique.md has no section for Option ${missing}`;

  const issues = [
    ...findUntaggedObjections(critique),
    ...findUnknownMarkers(critique, findings).map((m) => `Unknown marker: ${m}`),
    ...findBadQuotes(critique, [read("brief.md"), findings, options]).map((q) => `Quote not in inputs: "${q}"`),
  ];
  return issues.length > 0 ? issues.join("; ") : null;
}

/** Numbered objections, per option section, whose text carries no well-formed severity tag. */
function findUntaggedObjections(critique: string): string[] {
  return critique.split(/^(?=## Option )/m).flatMap((section) => {
    const letter = /^## Option ([A-Z])\b/.exec(section)?.[1];
    const objections = /^### Objections\s*$([\s\S]*?)(?=^#{2,3} |(?![\s\S]))/m.exec(section)?.[1];
    if (!letter || !objections) return [];
    return objections
      .split(/^(?=\d+\. )/m)
      .filter((item) => /^\d+\. /.test(item))
      .filter((item) => !SEVERITY.test(item.replace(/\s+/g, " ")))
      .map((item) => `Option ${letter} objection ${/^(\d+)/.exec(item)![1]} has no severity tag`);
  });
}
