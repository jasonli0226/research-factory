import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchPage, formatPapers, formatSearchResults, paperSearch, webSearch } from "../../extensions/web-tools/lib/tools.js";
import type { HttpGet } from "../../extensions/web-tools/lib/tools.js";

const searxngJson = readFileSync(new URL("../fixtures/searxng.json", import.meta.url), "utf8");
const ddgHtml = readFileSync(new URL("../fixtures/ddg.html", import.meta.url), "utf8");
const openalexJson = readFileSync(new URL("../fixtures/openalex.json", import.meta.url), "utf8");

const samplePdf = new Uint8Array(readFileSync(new URL("../fixtures/sample.pdf", import.meta.url)));

const SEARXNG = "http://127.0.0.1:8888";

type Route = { status?: number; body?: string; bytes?: Uint8Array; contentType?: string };

function fakeHttp(routes: Record<string, Route | Error>): HttpGet {
  return async (url) => {
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    const route = key ? routes[key] : undefined;
    if (!route) throw new Error(`unexpected url ${url}`);
    if (route instanceof Error) throw route;
    return {
      status: route.status ?? 200,
      bytes: route.bytes ?? new TextEncoder().encode(route.body ?? ""),
      contentType: route.contentType ?? "text/html",
      finalUrl: url,
    };
  };
}

describe("webSearch", () => {
  it("uses SearXNG when it answers", async () => {
    const http = fakeHttp({ [SEARXNG]: { body: searxngJson, contentType: "application/json" } });
    const { results, backend } = await webSearch({ query: "q", limit: 5, searxngUrl: SEARXNG, http });
    expect(backend).toBe("searxng");
    expect(results).toHaveLength(3);
  });

  it("falls back to DuckDuckGo when SearXNG is down", async () => {
    const http = fakeHttp({
      [SEARXNG]: new Error("ECONNREFUSED"),
      "https://html.duckduckgo.com": { body: ddgHtml },
    });
    const { results, backend } = await webSearch({ query: "q", limit: 5, searxngUrl: SEARXNG, http });
    expect(backend).toBe("duckduckgo");
    expect(results).toHaveLength(3);
  });

  it("falls back when SearXNG returns no results", async () => {
    const http = fakeHttp({
      [SEARXNG]: { body: JSON.stringify({ results: [] }), contentType: "application/json" },
      "https://html.duckduckgo.com": { body: ddgHtml },
    });
    expect((await webSearch({ query: "q", limit: 5, searxngUrl: SEARXNG, http })).backend).toBe("duckduckgo");
  });

  it("throws a clear error when every backend fails", async () => {
    const http = fakeHttp({
      [SEARXNG]: new Error("down"),
      "https://html.duckduckgo.com": { status: 429, body: "" },
    });
    await expect(webSearch({ query: "q", limit: 5, searxngUrl: SEARXNG, http })).rejects.toThrow(/All search backends failed/);
  });

  it("rejects an empty query", async () => {
    await expect(webSearch({ query: "  ", limit: 5, searxngUrl: SEARXNG, http: fakeHttp({}) })).rejects.toThrow(/empty/);
  });
});

describe("paperSearch", () => {
  it("returns parsed OpenAlex papers", async () => {
    const http = fakeHttp({ "https://api.openalex.org": { body: openalexJson, contentType: "application/json" } });
    expect(await paperSearch({ query: "q", limit: 2, http })).toHaveLength(2);
  });
});

describe("fetchPage", () => {
  it("returns title and plain text, truncated to the limit", async () => {
    const page = `<html><head><title>T</title></head><body><p>${"word ".repeat(100)}</p></body></html>`;
    const http = fakeHttp({ "https://example.com": { body: page } });
    const result = await fetchPage({ url: "https://example.com/a", maxChars: 50, http });
    expect(result.title).toBe("T");
    expect(result.text).toHaveLength(50);
    expect(result.truncated).toBe(true);
  });

  it("returns plain text bodies unchanged", async () => {
    const http = fakeHttp({ "https://example.com": { body: "hello", contentType: "text/plain; charset=utf-8" } });
    expect((await fetchPage({ url: "https://example.com/t.txt", maxChars: 100, http })).text).toBe("hello");
  });

  it("extracts text from PDFs by content type", async () => {
    const http = fakeHttp({ "https://example.com/doc.pdf": { bytes: samplePdf, contentType: "application/pdf" } });
    const result = await fetchPage({ url: "https://example.com/doc.pdf", maxChars: 1000, http });
    expect(result.text).toBe("Adapters are trained on a 4-bit base model.");
    expect(result.truncated).toBe(false);
  });

  it("detects PDFs served as octet-stream by their magic bytes", async () => {
    const http = fakeHttp({ "https://example.com/dl": { bytes: samplePdf, contentType: "application/octet-stream" } });
    expect((await fetchPage({ url: "https://example.com/dl", maxChars: 1000, http })).text).toContain("4-bit");
  });

  it("reports unreadable PDFs clearly", async () => {
    const http = fakeHttp({ "https://example.com/bad.pdf": { body: "%PDF-1.4 garbage", contentType: "application/pdf" } });
    await expect(fetchPage({ url: "https://example.com/bad.pdf", maxChars: 10, http })).rejects.toThrow(/Could not read PDF/);
  });

  it("rejects non-http URLs, HTTP errors and unsupported content types", async () => {
    const http = fakeHttp({
      "https://example.com/404": { status: 404, body: "" },
      "https://example.com/img.png": { body: "PNG", contentType: "image/png" },
    });
    await expect(fetchPage({ url: "file:///etc/passwd", maxChars: 10, http })).rejects.toThrow(/http/);
    await expect(fetchPage({ url: "https://example.com/404", maxChars: 10, http })).rejects.toThrow(/404/);
    await expect(fetchPage({ url: "https://example.com/img.png", maxChars: 10, http })).rejects.toThrow(/Unsupported content type/);
  });
});

describe("formatting", () => {
  it("numbers search results with URL and snippet", () => {
    const text = formatSearchResults([{ title: "A", url: "https://a.com", snippet: "s", source: "x" }]);
    expect(text).toBe("1. A\n   https://a.com\n   s");
  });

  it("formats papers with year, citations and a shortened abstract", () => {
    const text = formatPapers([
      { title: "P", year: 2024, url: "https://doi.org/1", authors: ["X", "Y"], citedBy: 3, abstract: "a".repeat(600) },
    ]);
    expect(text).toContain("1. P (2024) - X, Y - cited by 3");
    expect(text).toContain("https://doi.org/1");
    expect(text).toContain("…");
  });
});
