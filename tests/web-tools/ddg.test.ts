import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDdgUrl, parseDdgHtml } from "../../extensions/web-tools/lib/ddg.js";

const html = readFileSync(new URL("../fixtures/ddg.html", import.meta.url), "utf8");

describe("buildDdgUrl", () => {
  it("encodes the query for the HTML endpoint", () => {
    expect(buildDdgUrl("a b&c")).toBe("https://html.duckduckgo.com/html/?q=a+b%26c");
  });
});

describe("parseDdgHtml", () => {
  it("extracts real target URLs, plain-text titles and snippets", () => {
    const results = parseDdgHtml(html, 10);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.url).toMatch(/^https?:\/\//);
      expect(r.url).not.toContain("duckduckgo.com/l/");
      expect(r.title).not.toMatch(/[<>]/);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.snippet.length).toBeGreaterThan(0);
      expect(r.source).toBe("duckduckgo");
    }
  });

  it("respects the limit and handles empty pages", () => {
    expect(parseDdgHtml(html, 1)).toHaveLength(1);
    expect(parseDdgHtml("<html></html>", 5)).toEqual([]);
  });
});
