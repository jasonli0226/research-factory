import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findBadQuotes, findUnknownMarkers } from "./text-checks.js";

const MIN_OPTIONS = 3;

/**
 * Validate `options.md` against `findings.md`: enough options, a comparison section, markers
 * that findings.md cites, and quotations copied word for word.
 * Returns an error message, or null when the file is valid.
 */
export function checkOptions(runDir: string): string | null {
  const optionsPath = join(runDir, "options.md");
  if (!existsSync(optionsPath)) return "options.md was not written";
  const options = readFileSync(optionsPath, "utf8");
  const findings = readFileSync(join(runDir, "findings.md"), "utf8");

  const count = options.match(/^## Option /gm)?.length ?? 0;
  if (count < MIN_OPTIONS) return `options.md has ${count} options; need at least ${MIN_OPTIONS}`;
  if (!/^## Comparison\s*$/m.test(options)) return "options.md has no ## Comparison section";

  const issues = [
    ...findUnknownMarkers(options, findings).map((m) => `Unknown marker: ${m}`),
    ...findBadQuotes(options, [findings]).map((q) => `Quote not in findings.md: "${q}"`),
  ];
  return issues.length > 0 ? issues.join("; ") : null;
}
