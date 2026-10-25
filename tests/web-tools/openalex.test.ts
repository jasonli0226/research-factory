import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildOpenAlexUrl, parseOpenAlexWorks, reconstructAbstract } from "../../extensions/web-tools/lib/openalex.js";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/openalex.json", import.meta.url), "utf8"));

describe("reconstructAbstract", () => {
  it("rebuilds text from an inverted index", () => {
    expect(reconstructAbstract({ efficient: [1], parameter: [0], tuning: [2] })).toBe("parameter efficient tuning");
  });

  it("returns an empty string when missing", () => {
    expect(reconstructAbstract(null)).toBe("");
    expect(reconstructAbstract(undefined)).toBe("");
  });
});

describe("buildOpenAlexUrl", () => {
  it("builds a search URL with a capped page size", () => {
    const url = new URL(buildOpenAlexUrl("lora fine-tuning", 500));
    expect(url.origin + url.pathname).toBe("https://api.openalex.org/works");
    expect(url.searchParams.get("search")).toBe("lora fine-tuning");
    expect(url.searchParams.get("per_page")).toBe("25");
  });
});

describe("parseOpenAlexWorks", () => {
  it("maps works to papers with abstract, authors and a link", () => {
    const papers = parseOpenAlexWorks(fixture);
    expect(papers).toHaveLength(2);
    const first = papers[0]!;
    expect(first.title).toBe(fixture.results[0].title);
    expect(first.year).toBe(fixture.results[0].publication_year);
    expect(first.url).toBe(fixture.results[0].doi);
    expect(first.abstract.split(" ").length).toBeGreaterThan(10);
    expect(Array.isArray(first.authors)).toBe(true);
  });

  it("returns an empty list for malformed input", () => {
    expect(parseOpenAlexWorks({})).toEqual([]);
  });
});
