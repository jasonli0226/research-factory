import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findBadQuotes, findMalformedMarkers, findUnknownMarkers } from "./text-checks.js";

const REQUIRED_SECTIONS = [
  "Recommendation",
  "Why this option",
  "Options not chosen",
  "Risks and open objections",
  "What would change this decision",
  "First steps",
];
const OPTION_HEADING = /^## Option ([A-Z])\b/gm;

/**
 * Validate `proposal.md`: the required sections, a recommendation that names one option from
 * options.md (or several with a ## Pilot section), well-formed markers that findings.md cites,
 * and quotations copied word for word from the inputs.
 * Returns an error message, or null when the file is valid.
 */
export function checkProposal(runDir: string): string | null {
  const proposalPath = join(runDir, "proposal.md");
  if (!existsSync(proposalPath)) return "proposal.md was not written";
  const read = (name: string) => readFileSync(join(runDir, name), "utf8");
  const proposal = read("proposal.md");
  const findings = read("findings.md");
  const options = read("options.md");

  const missing = REQUIRED_SECTIONS.find((s) => !new RegExp(`^## ${s}\\b`, "m").test(proposal));
  if (missing) return `proposal.md has no ## ${missing} section`;

  const recommendationError = checkRecommendation(proposal, options);
  if (recommendationError) return recommendationError;

  const issues = [
    ...malformedIssue(findMalformedMarkers(proposal)),
    ...findUnknownMarkers(proposal, findings).map((m) => `Unknown marker: ${m}`),
    // The proposal's own headings count as a source: it may refer the reader to one of its sections.
    ...findBadQuotes(proposal, [read("brief.md"), findings, options, read("critique.md"), headings(proposal)]).map(
      (q) => `Quote not in inputs: "${q}"`,
    ),
  ];
  return issues.length > 0 ? issues.join("; ") : null;
}

/** One issue listing every malformed marker, with what to write instead. */
const malformedIssue = (markers: string[]) =>
  markers.length === 0
    ? []
    : [
        `${markers.map((m) => `Malformed marker: ${m}`).join("; ")}. Cite a source as [Qn.Sm]; ` +
          "end a sentence about a gap with (no published evidence) instead",
      ];

const headings = (text: string) => (text.match(/^#{1,3} .+$/gm) ?? []).map((h) => h.replace(/^#+ /, "")).join("\n");

/** The Recommendation must name known options: exactly one, or several when a pilot compares them. */
function checkRecommendation(proposal: string, options: string): string | null {
  const recommendation = /^## Recommendation\b([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(proposal)![1]!;
  const named = [...new Set([...recommendation.matchAll(/\bOption ([A-Z])\b/g)].map((m) => m[1]!))].sort();
  const known = new Set([...options.matchAll(OPTION_HEADING)].map((m) => m[1]));
  if (named.length === 0) return "Recommendation names no option from options.md";
  const unknown = named.find((l) => !known.has(l));
  if (unknown) return `Recommendation names unknown Option ${unknown}`;
  if (named.length > 1 && !/^## Pilot\b/m.test(proposal)) {
    return `Recommendation names Options ${named.join(", ")}; name one option or add a ## Pilot section`;
  }
  return null;
}
