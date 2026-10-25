import { describe, expect, it } from "vitest";
import { buildPiArgs } from "../../orchestrator/src/pi-runner.js";

describe("buildPiArgs", () => {
  it("builds a non-interactive JSON-mode invocation with skill, tools and model", () => {
    const args = buildPiArgs({
      cwd: "/run",
      skillDir: "/f/skills/researcher",
      extensions: ["/f/extensions/web-tools"],
      tools: ["read", "write", "web_search"],
      provider: "openrouter",
      model: "~z-ai/glm-flash-latest",
      prompt: "Do Q1",
      sessionDir: "/run/sessions",
      timeoutMs: 1000,
    });
    expect(args).toEqual([
      "-p",
      "--mode", "json",
      "--session-dir", "/run/sessions",
      "--no-context-files",
      "--no-skills",
      "--skill", "/f/skills/researcher",
      "--extension", "/f/extensions/web-tools",
      "--tools", "read,write,web_search",
      "--provider", "openrouter",
      "--model", "~z-ai/glm-flash-latest",
      "Do Q1",
    ]);
  });

  it("puts the prompt after -- when it starts with a dash", () => {
    const args = buildPiArgs({
      cwd: "/r", skillDir: "/s", extensions: [], tools: ["read"], provider: "p", model: "m",
      prompt: "--weird", sessionDir: "/r/s", timeoutMs: 1,
    });
    expect(args.slice(-2)).toEqual(["--", "--weird"]);
  });
});
