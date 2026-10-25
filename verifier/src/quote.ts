const QUOTE_CHARS: ReadonlyArray<[RegExp, string]> = [
  [/[“”„″]/g, '"'],
  [/[‘’‚′]/g, "'"],
  [/[‐-―−]/g, "-"],
];

/** Lowercase, unify curly quotes and dashes, strip HTML tags and collapse whitespace. */
export function normalizeText(text: string): string {
  const unified = QUOTE_CHARS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  return unified
    .replace(/<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when the quote appears in the page text after normalization. */
export function containsQuote(pageText: string, quote: string): boolean {
  const needle = normalizeText(quote);
  return needle.length > 0 && normalizeText(pageText).includes(needle);
}

// Tokens that PDF and HTML extraction leave behind as list bullets.
const NOISE_TOKENS = new Set(["o"]);

/** Word tokens with hyphenated line breaks joined and bullet noise removed. */
function looseTokens(text: string): string[] {
  const joined = normalizeText(text).replace(/(\p{L})- (\p{L})/gu, "$1$2");
  return (joined.match(/[\p{L}\p{N}%]+/gu) ?? []).filter((token) => !NOISE_TOKENS.has(token));
}

export type QuoteMatch = "exact" | "loose" | null;

// Short quotes are too easy to find by accident once spacing is ignored.
const MIN_COMPACT_CHARS = 20;

/**
 * Exact match after normalization; else "loose": the same words in order ignoring punctuation and
 * bullet noise, or (for longer quotes) the same letters and digits in order ignoring all spacing,
 * which covers words that PDF extraction split apart.
 */
export function matchQuote(pageText: string, quote: string): QuoteMatch {
  if (containsQuote(pageText, quote)) return "exact";
  const needle = looseTokens(quote);
  if (needle.length === 0) return null;
  const pageTokens = looseTokens(pageText);
  if (` ${pageTokens.join(" ")} `.includes(` ${needle.join(" ")} `)) return "loose";
  const compactNeedle = needle.join("");
  return compactNeedle.length >= MIN_COMPACT_CHARS && pageTokens.join("").includes(compactNeedle) ? "loose" : null;
}
