/** Checks shared by the validators of stages that write from findings.md. */

/** Quoted text shorter than this is treated as a term ("what-if"), not a quotation. */
const MIN_QUOTE_WORDS = 4;
const MARKER = /\[Q\d+\.S\d+\]/g;
const QUOTE = /"([^"]+)"|“([^”]+)”/g;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Distinct `[Qn.Sm]` markers in `text` that `findings` never cites. */
export function findUnknownMarkers(text: string, findings: string): string[] {
  const known = new Set(findings.match(MARKER));
  return [...new Set(text.match(MARKER))].filter((m) => !known.has(m));
}

/** Distinct quotations in `text` that do not appear word for word in any of `sources`. */
export function findBadQuotes(text: string, sources: readonly string[]): string[] {
  const flat = sources.map(normalize);
  const quotes = [...text.matchAll(QUOTE)].map((m) => normalize(m[1] ?? m[2]!));
  return [...new Set(quotes)].filter((q) => q.split(" ").length >= MIN_QUOTE_WORDS && !flat.some((s) => s.includes(q)));
}

/** Distinct bracketed `Q` references in `text` that are not a well-formed `[Qn.Sm]` marker. */
export function findMalformedMarkers(text: string): string[] {
  return [...new Set(text.match(/\[Q[^\]\n]*\]/g))].filter((m) => !/^\[Q\d+\.S\d+\]$/.test(m));
}
