import { describe, expect, it } from "vitest";
import { withRetry } from "../../verifier/src/retry.js";

const noSleep = async () => {};

describe("withRetry", () => {
  it("retries transient failures and returns the first success", async () => {
    let calls = 0;
    const flaky = async (_url: string) => {
      calls += 1;
      if (calls < 3) throw new Error("fetch failed: ECONNRESET");
      return "page";
    };
    expect(await withRetry(flaky, { retries: 2, baseDelayMs: 1, sleep: noSleep })("u")).toBe("page");
    expect(calls).toBe(3);
  });

  it("gives up after the retry limit with the last error", async () => {
    let calls = 0;
    const down = async (_url: string) => {
      calls += 1;
      throw new Error(`HTTP 503 #${calls}`);
    };
    await expect(withRetry(down, { retries: 2, baseDelayMs: 1, sleep: noSleep })("u")).rejects.toThrow("HTTP 503 #3");
  });

  it("does not retry permanent errors like 404", async () => {
    let calls = 0;
    const missing = async (_url: string) => {
      calls += 1;
      throw new Error("https://x returned HTTP 404");
    };
    await expect(withRetry(missing, { retries: 2, baseDelayMs: 1, sleep: noSleep })("u")).rejects.toThrow("404");
    expect(calls).toBe(1);
  });

  it("backs off exponentially", async () => {
    const delays: number[] = [];
    const down = async (_url: string) => {
      throw new Error("timeout");
    };
    const sleep = async (ms: number) => {
      delays.push(ms);
    };
    await expect(withRetry(down, { retries: 2, baseDelayMs: 100, sleep })("u")).rejects.toThrow();
    expect(delays).toEqual([100, 200]);
  });
});
