import { describe, expect, it } from "vitest";
import { parseBacklogIds } from "../../orchestrator/src/backlog.js";
import { mapWithConcurrency } from "../../orchestrator/src/pool.js";

describe("parseBacklogIds", () => {
  it("lists sub-question ids in order without duplicates", () => {
    const md = "# Backlog\n\n## Q1: A\n- Question: a?\n\n## Q2: B\n\n## Q10: C\n## Q2: again\nnot ## Q9 heading";
    expect(parseBacklogIds(md)).toEqual(["Q1", "Q2", "Q10"]);
  });

  it("returns an empty list when there are no sub-questions", () => {
    expect(parseBacklogIds("# Backlog\n")).toEqual([]);
  });
});

describe("mapWithConcurrency", () => {
  it("keeps result order and never exceeds the limit", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, i) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, ms));
      active -= 1;
      return i * 10;
    });
    expect(results).toEqual([0, 10, 20, 30, 40]);
    expect(peak).toBe(2);
  });
});
