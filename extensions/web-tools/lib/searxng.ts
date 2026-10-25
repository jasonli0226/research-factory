import type { SearchResult } from "./types.js";

export function buildSearxngUrl(baseUrl: string, query: string): string {
  const params = new URLSearchParams({ q: query, format: "json" });
  return `${baseUrl.replace(/\/+$/, "")}/search?${params.toString()}`;
}

export function parseSearxngResults(body: unknown, limit: number): SearchResult[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((r): r is Record<string, unknown> => typeof r?.url === "string" && r.url.length > 0)
    .slice(0, limit)
    .map((r) => ({
      title: String(r.title ?? ""),
      url: String(r.url),
      snippet: String(r.content ?? ""),
      source: `searxng:${String(r.engine ?? "unknown")}`,
    }));
}
