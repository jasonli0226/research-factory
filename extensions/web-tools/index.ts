// pi extension: web_search (SearXNG, DuckDuckGo fallback), paper_search (OpenAlex), web_fetch.
// Load with: pi --extension ./extensions/web-tools
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createHttpGet } from "./lib/http.js";
import { fetchPage, formatPapers, formatSearchResults, paperSearch, webSearch } from "./lib/tools.js";

const SEARXNG_URL = process.env.SEARXNG_URL ?? "http://127.0.0.1:8888";
const DEFAULT_RESULTS = 8;
const MAX_RESULTS = 20;
const DEFAULT_FETCH_CHARS = 20_000;
const MAX_FETCH_CHARS = 60_000;

const http = createHttpGet();
const clamp = (value: number | undefined, fallback: number, max: number) =>
  Math.max(1, Math.min(value ?? fallback, max));

const webSearchTool = defineTool({
  name: "web_search",
  label: "Web search",
  description:
    "Search the web. Returns numbered results with title, URL and snippet. Snippets are not evidence: " +
    "use web_fetch on a result before citing it.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    limit: Type.Optional(Type.Number({ description: `Max results (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS})` })),
  }),
  async execute(_id, params, signal) {
    const { results, backend } = await webSearch({
      query: params.query,
      limit: clamp(params.limit, DEFAULT_RESULTS, MAX_RESULTS),
      searxngUrl: SEARXNG_URL,
      http,
      signal,
    });
    return {
      content: [{ type: "text", text: `[${backend}] ${results.length} results\n${formatSearchResults(results)}` }],
      details: { backend, results },
    };
  },
});

const paperSearchTool = defineTool({
  name: "paper_search",
  label: "Paper search",
  description:
    "Search academic papers (OpenAlex). Returns title, year, authors, citation count, DOI link and abstract preview.",
  parameters: Type.Object({
    query: Type.String({ description: "Search query" }),
    limit: Type.Optional(Type.Number({ description: `Max papers (default ${DEFAULT_RESULTS}, max ${MAX_RESULTS})` })),
  }),
  async execute(_id, params, signal) {
    const papers = await paperSearch({
      query: params.query,
      limit: clamp(params.limit, DEFAULT_RESULTS, MAX_RESULTS),
      http,
      signal,
    });
    return {
      content: [{ type: "text", text: `${papers.length} papers\n${formatPapers(papers)}` }],
      details: { papers },
    };
  },
});

const webFetchTool = defineTool({
  name: "web_fetch",
  label: "Web fetch",
  description:
    "Fetch a web page and return its readable text. Quote evidence exactly from this text. " +
    "Supports HTML, plain text and PDF (text-based PDFs; scanned images are not OCRed).",
  parameters: Type.Object({
    url: Type.String({ description: "http(s) URL to fetch" }),
    max_chars: Type.Optional(
      Type.Number({ description: `Max characters returned (default ${DEFAULT_FETCH_CHARS}, max ${MAX_FETCH_CHARS})` }),
    ),
  }),
  async execute(_id, params, signal) {
    const page = await fetchPage({
      url: params.url,
      maxChars: clamp(params.max_chars, DEFAULT_FETCH_CHARS, MAX_FETCH_CHARS),
      http,
      signal,
    });
    const note = page.truncated ? "\n\n[truncated: call again with a larger max_chars if needed]" : "";
    return {
      content: [{ type: "text", text: `URL: ${page.url}\nTitle: ${page.title}\n\n${page.text}${note}` }],
      details: { url: page.url, title: page.title, truncated: page.truncated },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(webSearchTool);
  pi.registerTool(paperSearchTool);
  pi.registerTool(webFetchTool);
}
