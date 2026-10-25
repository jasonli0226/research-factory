import type { Paper } from "./types.js";

const MAX_PER_PAGE = 25;
const SELECT_FIELDS = "id,doi,title,publication_year,authorships,cited_by_count,abstract_inverted_index,primary_location";

export function buildOpenAlexUrl(query: string, limit: number): string {
  const perPage = Math.max(1, Math.min(limit, MAX_PER_PAGE));
  const params = new URLSearchParams({ search: query, per_page: String(perPage), select: SELECT_FIELDS });
  return `https://api.openalex.org/works?${params.toString()}`;
}

export function reconstructAbstract(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const positioned = Object.entries(index).flatMap(([word, positions]) => positions.map((p) => [p, word] as const));
  return [...positioned]
    .sort((a, b) => a[0] - b[0])
    .map(([, word]) => word)
    .join(" ");
}

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  cited_by_count?: number;
  authorships?: { author?: { display_name?: string } }[];
  abstract_inverted_index?: Record<string, number[]> | null;
  primary_location?: { landing_page_url?: string | null } | null;
}

export function parseOpenAlexWorks(body: unknown): Paper[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return (results as OpenAlexWork[]).map((w) => ({
    title: w.title ?? "",
    year: w.publication_year ?? null,
    url: w.doi ?? w.primary_location?.landing_page_url ?? w.id ?? "",
    authors: (w.authorships ?? []).map((a) => a.author?.display_name ?? "").filter((n) => n.length > 0),
    citedBy: w.cited_by_count ?? 0,
    abstract: reconstructAbstract(w.abstract_inverted_index),
  }));
}
