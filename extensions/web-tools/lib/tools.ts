import { buildDdgUrl, parseDdgHtml } from "./ddg.js";
import { extractTitle, htmlToText, truncateText } from "./html-text.js";
import { buildOpenAlexUrl, parseOpenAlexWorks } from "./openalex.js";
import { isPdf, pdfToText } from "./pdf.js";
import { buildSearxngUrl, parseSearxngResults } from "./searxng.js";
import type { Paper, SearchResult } from "./types.js";

export interface HttpResponse {
  readonly status: number;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly finalUrl: string;
}

export type HttpGet = (url: string, signal?: AbortSignal) => Promise<HttpResponse>;

const ABSTRACT_PREVIEW_CHARS = 400;
const TEXT_CONTENT_TYPES = /^(text\/|application\/(json|xml|xhtml\+xml)\b)/i;

function ensureOk(response: HttpResponse, what: string): HttpResponse {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${what} returned HTTP ${response.status}`);
  }
  return response;
}

function bodyText(response: HttpResponse): string {
  return new TextDecoder("utf-8").decode(response.bytes);
}

function requireQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length === 0) throw new Error("Search query is empty");
  return trimmed;
}

export async function webSearch(opts: {
  query: string;
  limit: number;
  searxngUrl: string;
  http: HttpGet;
  signal?: AbortSignal;
}): Promise<{ results: SearchResult[]; backend: "searxng" | "duckduckgo" }> {
  const query = requireQuery(opts.query);
  const errors: string[] = [];

  try {
    const res = ensureOk(await opts.http(buildSearxngUrl(opts.searxngUrl, query), opts.signal), "SearXNG");
    const results = parseSearxngResults(JSON.parse(bodyText(res)), opts.limit);
    if (results.length > 0) return { results, backend: "searxng" };
    errors.push("SearXNG: no results");
  } catch (err) {
    errors.push(`SearXNG: ${(err as Error).message}`);
  }

  try {
    const res = ensureOk(await opts.http(buildDdgUrl(query), opts.signal), "DuckDuckGo");
    const results = parseDdgHtml(bodyText(res), opts.limit);
    if (results.length > 0) return { results, backend: "duckduckgo" };
    errors.push("DuckDuckGo: no results");
  } catch (err) {
    errors.push(`DuckDuckGo: ${(err as Error).message}`);
  }

  throw new Error(`All search backends failed (${errors.join("; ")})`);
}

export async function paperSearch(opts: {
  query: string;
  limit: number;
  http: HttpGet;
  signal?: AbortSignal;
}): Promise<Paper[]> {
  const query = requireQuery(opts.query);
  const res = ensureOk(await opts.http(buildOpenAlexUrl(query, opts.limit), opts.signal), "OpenAlex");
  return parseOpenAlexWorks(JSON.parse(bodyText(res)));
}

export async function fetchPage(opts: {
  url: string;
  maxChars: number;
  http: HttpGet;
  signal?: AbortSignal;
}): Promise<{ url: string; title: string; text: string; truncated: boolean }> {
  if (!/^https?:\/\//i.test(opts.url)) throw new Error("Only http(s) URLs can be fetched");
  const res = ensureOk(await opts.http(opts.url, opts.signal), opts.url);
  if (isPdf(res.bytes, res.contentType)) {
    const { text, truncated } = truncateText(await pdfToText(res.bytes), opts.maxChars);
    return { url: res.finalUrl, title: "", text, truncated };
  }
  if (!TEXT_CONTENT_TYPES.test(res.contentType)) {
    throw new Error(`Unsupported content type: ${res.contentType || "unknown"}`);
  }
  const body = bodyText(res);
  const isHtml = /html/i.test(res.contentType);
  const { text, truncated } = truncateText(isHtml ? htmlToText(body) : body, opts.maxChars);
  return { url: res.finalUrl, title: isHtml ? extractTitle(body) : "", text, truncated };
}

export function formatSearchResults(results: readonly SearchResult[]): string {
  return results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join("\n");
}

export function formatPapers(papers: readonly Paper[]): string {
  return papers
    .map((p, i) => {
      const abstract =
        p.abstract.length > ABSTRACT_PREVIEW_CHARS ? `${p.abstract.slice(0, ABSTRACT_PREVIEW_CHARS)}…` : p.abstract;
      const header = `${i + 1}. ${p.title} (${p.year ?? "n.d."}) - ${p.authors.slice(0, 3).join(", ")} - cited by ${p.citedBy}`;
      return `${header}\n   ${p.url}\n   ${abstract || "(no abstract)"}`;
    })
    .join("\n");
}
