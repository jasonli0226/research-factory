import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSearxngUrl, parseSearxngResults } from "../../extensions/web-tools/lib/searxng.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/searxng.json", import.meta.url), "utf8"));

describe("buildSearxngUrl", () => {
  it("builds a JSON search URL and tolerates a trailing slash", () => {
    expect(buildSearxngUrl("http://127.0.0.1:8888/", "lora fine-tuning & rag")).toBe(
      "http://127.0.0.1:8888/search?q=lora+fine-tuning+%26+rag&format=json",
    );
  });
});

describe("parseSearxngResults", () => {
  it("maps results and drops entries without a URL", () => {
    const results = parseSearxngResults(fixture, 10);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      title: fixture.results[0].title,
      url: fixture.results[0].url,
      snippet: fixture.results[0].content,
      source: "searxng:google cse",
    });
  });

  it("respects the limit", () => {
    expect(parseSearxngResults(fixture, 2)).toHaveLength(2);
  });

  it("returns an empty list for malformed input", () => {
    expect(parseSearxngResults({ nope: true }, 5)).toEqual([]);
    expect(parseSearxngResults(null, 5)).toEqual([]);
  });
});
