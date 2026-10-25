import { describe, expect, it } from "vitest";
import { findMarkerIssues, parseSourcesFile } from "../../verifier/src/sources.js";

const good = JSON.stringify([
  { id: "S1", url: "https://a.com/x", quote: "q1", claim: "c1" },
  { id: "S2", url: "https://a.com/x", quote: "q2", claim: "c2" },
]);

describe("parseSourcesFile", () => {
  it("accepts a valid sources array", () => {
    const result = parseSourcesFile(good);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sources).toHaveLength(2);
  });

  it("rejects invalid JSON", () => {
    const result = parseSourcesFile("{nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Invalid JSON/);
  });

  it("rejects missing fields, empty quotes and non-http URLs", () => {
    const result = parseSourcesFile(JSON.stringify([{ id: "S1", url: "ftp://a", quote: "", claim: "c" }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/url|quote/i);
  });

  it("rejects duplicate ids", () => {
    const dup = JSON.stringify([
      { id: "S1", url: "https://a.com", quote: "a", claim: "c" },
      { id: "S1", url: "https://b.com", quote: "b", claim: "c" },
    ]);
    const result = parseSourcesFile(dup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/Duplicate id S1/);
  });
});

describe("findMarkerIssues", () => {
  it("reports markers with no source and sources never cited", () => {
    const notes = "Claim one [S1]. Claim two [S3][S1].";
    expect(findMarkerIssues(notes, ["S1", "S2"])).toEqual({ missing: ["S3"], unused: ["S2"] });
  });

  it("is clean when markers and sources line up", () => {
    expect(findMarkerIssues("a [S1] b [S2]", ["S1", "S2"])).toEqual({ missing: [], unused: [] });
  });
});
