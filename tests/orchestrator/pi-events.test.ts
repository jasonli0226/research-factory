import { describe, expect, it } from "vitest";
import { parsePiEvents } from "../../orchestrator/src/pi-events.js";

const line = (o: unknown) => JSON.stringify(o);
const assistant = (stopReason: string, cost: number, extra: Record<string, unknown> = {}) =>
  line({
    type: "message_end",
    message: {
      role: "assistant",
      stopReason,
      content: [{ type: "text", text: `reply ${cost}` }],
      usage: { cost: { total: cost } },
      ...extra,
    },
  });

describe("parsePiEvents", () => {
  it("sums cost across assistant messages and reports success", () => {
    const out = [line({ type: "session" }), assistant("toolUse", 0.01), assistant("stop", 0.02), ""].join("\n");
    const result = parsePiEvents(out);
    expect(result.costUsd).toBeCloseTo(0.03);
    expect(result.ok).toBe(true);
    expect(result.finalText).toBe("reply 0.02");
  });

  it("treats a final error stop reason as failure, even though pi exits 0", () => {
    const out = [assistant("error", 0, { errorMessage: "403 prohibited" })].join("\n");
    expect(parsePiEvents(out)).toMatchObject({ ok: false, error: "403 prohibited" });
  });

  it("fails when there is no assistant message", () => {
    expect(parsePiEvents(line({ type: "session" })).ok).toBe(false);
  });

  it("skips malformed lines and handles CRLF", () => {
    const out = `not json\r\n${assistant("stop", 0.5)}\r\n`;
    expect(parsePiEvents(out)).toMatchObject({ ok: true, costUsd: 0.5 });
  });
});
