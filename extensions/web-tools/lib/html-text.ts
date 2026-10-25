const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

const DROPPED_ELEMENTS = ["script", "style", "noscript", "svg", "nav", "footer", "header", "aside", "form", "template"];
const BLOCK_TAGS = /<\/?(p|div|br|h[1-6]|li|ul|ol|tr|table|section|article|blockquote|pre|hr|dd|dt)\b[^>]*>/gi;

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const isHex = code[1]?.toLowerCase() === "x";
      const value = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Replace MathML with its alttext, or drop its TeX annotation, so formulas appear once. */
function flattenMath(html: string): string {
  return html
    .replace(/<math\b[^>]*\balttext="([^"]*)"[^>]*>[\s\S]*?<\/math>/gi, (_m, alt: string) => ` ${alt} `)
    .replace(/<annotation(-xml)?\b[^>]*>[\s\S]*?<\/annotation(-xml)?>/gi, " ");
}

/** Convert an HTML page to readable plain text, one block per line. */
export function htmlToText(html: string): string {
  const withoutDropped = DROPPED_ELEMENTS.reduce(
    (acc, tag) => acc.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), " "),
    flattenMath(html.replace(/<!--[\s\S]*?-->/g, " ")),
  );
  const text = decodeEntities(withoutDropped.replace(BLOCK_TAGS, "\n").replace(/<[^>]+>/g, " "));
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function extractTitle(html: string): string {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match?.[1] ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  return text.length <= maxChars
    ? { text, truncated: false }
    : { text: text.slice(0, maxChars), truncated: true };
}
