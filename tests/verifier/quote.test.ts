import { describe, expect, it } from "vitest";
import { containsQuote, normalizeText } from "../../verifier/src/quote.js";

describe("normalizeText", () => {
  it("collapses whitespace, lowercases and unifies quote characters", () => {
    expect(normalizeText("  The  “Quick”\n\tFox’s  ")).toBe('the "quick" fox\'s');
  });
});

describe("normalizeText angle brackets", () => {
  it("keeps text between comparison signs that are not HTML tags", () => {
    expect(normalizeText("significant at p < 0.001. Among all six models, a > b")).toBe(
      "significant at p < 0.001. among all six models, a > b",
    );
  });

  it("still strips real tags", () => {
    expect(normalizeText('<p class="x">Hi</p><br/>there')).toBe("hi there");
  });
});

describe("normalizeText dashes", () => {
  it("unifies hyphen and dash variants", () => {
    expect(normalizeText("check\u2011in \u2010 a\u2013b \u2212 c")).toBe("check-in - a-b - c");
  });
});

describe("containsQuote", () => {
  const page = "<p>Revenue grew   by 12%\nin 2025, according to the “annual” report.</p>";

  it("finds a quote despite whitespace and quote-style differences", () => {
    expect(containsQuote(page, 'grew by 12% in 2025, according to the "annual" report')).toBe(true);
  });

  it("rejects a quote that is not on the page", () => {
    expect(containsQuote(page, "revenue grew by 15%")).toBe(false);
  });

  it("rejects empty quotes", () => {
    expect(containsQuote(page, "   ")).toBe(false);
  });
});

describe("matchQuote", () => {
  it("reports an exact match", async () => {
    const { matchQuote } = await import("../../verifier/src/quote.js");
    expect(matchQuote("Revenue grew by 12% in 2025.", "grew by 12%")).toBe("exact");
  });

  it("loosely matches across bullet markers and hyphenated line breaks", async () => {
    const { matchQuote } = await import("../../verifier/src/quote.js");
    const pdfText = "short-term fore-\ncast of: o waiting times in • certain endpoints";
    expect(matchQuote(pdfText, "short-term forecast of: waiting times in certain endpoints")).toBe("loose");
  });

  it("loosely matches words that PDF extraction split apart", async () => {
    const { matchQuote } = await import("../../verifier/src/quote.js");
    const pdfText = "Am\nong all six models shown in Table 1, our regression tree has the lowest average pinball loss\n(2.73) and is best";
    expect(matchQuote(pdfText, "Among all six models shown in Table 1, our regression tree has the lowest average pinball loss (2.73)")).toBe("loose");
  });

  it("does not loosely match when real words differ", async () => {
    const { matchQuote } = await import("../../verifier/src/quote.js");
    const page = "from fine tuning to minimising costs to faster training";
    expect(matchQuote(page, "from fine-tuning to training to model serving")).toBeNull();
  });

  it("does not skip real one-letter words in the quote", async () => {
    const { matchQuote } = await import("../../verifier/src/quote.js");
    expect(matchQuote("plan a b test", "plan b test")).toBeNull();
  });
});
