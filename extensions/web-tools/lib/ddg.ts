import { decodeEntities } from "./html-text.js";
import type { SearchResult } from "./types.js";

export function buildDdgUrl(query: string): string {
  return `https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query }).toString()}`;
}

function resolveRedirect(href: string): string {
  const absolute = href.startsWith("//") ? `https:${href}` : href;
  try {
    const target = new URL(absolute).searchParams.get("uddg");
    return target ?? absolute;
  } catch {
    return absolute;
  }
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Parse the DuckDuckGo HTML endpoint's result page. */
export function parseDdgHtml(html: string, limit: number): SearchResult[] {
  const blocks = html.split(/<div class="result results_links/).slice(1);
  return blocks
    .map((block) => {
      const link = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      const snippet = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(block);
      if (!link?.[1] || !link[2]) return null;
      return {
        title: stripTags(link[2]),
        url: resolveRedirect(decodeEntities(link[1])),
        snippet: snippet?.[1] ? stripTags(snippet[1]) : "",
        source: "duckduckgo",
      };
    })
    .filter((r): r is SearchResult => r !== null && /^https?:\/\//.test(r.url))
    .slice(0, limit);
}
