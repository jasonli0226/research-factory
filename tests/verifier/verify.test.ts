import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyRun, type FetchText } from "../../verifier/src/verify.js";

function makeRun(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "rf-verify-"));
  mkdirSync(join(dir, "notes"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, "notes", name), content);
  return dir;
}

const pages: Record<string, string> = {
  "https://a.com/1": "Models are retrained 2 hours ahead. Adapters use 10-minute data.",
  "https://b.com/2": "Plan o batches per • hour.",
};

const fetchText: FetchText = async (url) => {
  const page = pages[url];
  if (page === undefined) throw new Error("HTTP 403");
  return page;
};

const src = (id: string, url: string, quote: string) => ({ id, url, quote, claim: "c" });

describe("verifyRun", () => {
  it("passes when every quote is found", async () => {
    const dir = makeRun({
      "Q1.md": "x [S1] y [S2]",
      "Q1.sources.json": JSON.stringify([
        src("S1", "https://a.com/1", "retrained 2 hours ahead"),
        src("S2", "https://b.com/2", "Plan batches per hour."),
      ]),
    });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 1 });
    expect(report.summary).toMatchObject({ total: 2, exact: 1, loose: 1, notFound: 0, fetchFailed: 0, passed: true });
    expect(report.questions.Q1?.passed).toBe(true);
  });

  it("fails on fabricated quotes, unreachable pages and marker problems", async () => {
    const dir = makeRun({
      "Q1.md": "x [S1] y [S2] z [S9]",
      "Q1.sources.json": JSON.stringify([
        src("S1", "https://a.com/1", "retrained 6 hours ahead"),
        src("S2", "https://gone.com", "anything"),
        src("S3", "https://a.com/1", "Adapters use 10-minute data."),
      ]),
    });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 1 });
    const q1 = report.questions.Q1!;
    expect(q1.passed).toBe(false);
    expect(q1.results.map((r) => [r.id, r.status])).toEqual([
      ["S1", "not_found"],
      ["S2", "fetch_failed"],
      ["S3", "exact"],
    ]);
    expect(q1.markers).toEqual({ missing: ["S9"], unused: ["S3"] });
    expect(report.summary.passed).toBe(false);
  });

  it("fails a question whose sources file is invalid", async () => {
    const dir = makeRun({ "Q2.md": "x", "Q2.sources.json": "{bad" });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 1 });
    expect(report.questions.Q2?.passed).toBe(false);
    expect(report.questions.Q2?.errors[0]).toMatch(/Invalid JSON/);
  });

  it("fails a question with notes but no sources file", async () => {
    const dir = makeRun({ "Q3.md": "x [S1]" });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 1 });
    expect(report.questions.Q3?.errors[0]).toMatch(/Missing Q3.sources.json/);
  });

  it("fetches each URL only once", async () => {
    let calls = 0;
    const counting: FetchText = async (url) => {
      calls += 1;
      return fetchText(url);
    };
    const dir = makeRun({
      "Q1.md": "[S1][S2]",
      "Q1.sources.json": JSON.stringify([
        src("S1", "https://a.com/1", "retrained 2 hours ahead"),
        src("S2", "https://a.com/1", "Adapters use 10-minute data."),
      ]),
    });
    await verifyRun(dir, { fetchText: counting, minVerifiedRatio: 1 });
    expect(calls).toBe(1);
  });

  it("applies the verified-ratio threshold", async () => {
    const dir = makeRun({
      "Q1.md": "[S1][S2]",
      "Q1.sources.json": JSON.stringify([
        src("S1", "https://a.com/1", "retrained 2 hours ahead"),
        src("S2", "https://a.com/1", "made up words"),
      ]),
    });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 0.5 });
    expect(report.questions.Q1?.passed).toBe(true);
    expect(report.summary.ratio).toBe(0.5);
  });
});

describe("verifyRun questionIds", () => {
  it("verifies only the requested questions", async () => {
    const dir = makeRun({
      "Q1.md": "[S1]",
      "Q1.sources.json": JSON.stringify([src("S1", "https://a.com/1", "retrained 2 hours ahead")]),
      "Q2.md": "[S1]",
      "Q2.sources.json": "{bad",
    });
    const report = await verifyRun(dir, { fetchText, minVerifiedRatio: 1, questionIds: ["Q1"] });
    expect(Object.keys(report.questions)).toEqual(["Q1"]);
    expect(report.summary.passed).toBe(true);
  });
});
