import { describe, expect, it } from "vitest";
import { evaluatorStageFor, modelFamily } from "../../orchestrator/src/model-family.js";

const deepseek = { provider: "openrouter", model: "~deepseek/deepseek-flash-latest" };
const deepseekV4 = { provider: "openrouter", model: "~deepseek/deepseek-v4-flash-latest" };
const glm = { provider: "openrouter", model: "~z-ai/glm-flash-latest" };
const kimi = { provider: "openrouter", model: "~moonshotai/kimi-latest" };

describe("modelFamily", () => {
  it("is the vendor prefix of the model id, without the latest-alias tilde", () => {
    expect(modelFamily("~deepseek/deepseek-flash-latest")).toBe("deepseek");
    expect(modelFamily("z-ai/glm-4.6")).toBe("z-ai");
  });

  it("is the whole id when there is no vendor prefix", () => {
    expect(modelFamily("local-model")).toBe("local-model");
  });
});

describe("evaluatorStageFor", () => {
  const evaluator = { ...deepseek, fallback: deepseekV4, crossFamily: glm };

  it("keeps the configured models when the writer is another family", () => {
    expect(evaluatorStageFor(evaluator, glm.model)).toEqual({ ...deepseek, fallback: deepseekV4 });
  });

  it("switches to the cross-family model when the writer shares the evaluator's family", () => {
    expect(evaluatorStageFor(evaluator, deepseek.model)).toEqual(glm);
  });

  it("keeps a fallback from another family and uses the cross-family model after it", () => {
    expect(evaluatorStageFor({ ...deepseek, fallback: kimi, crossFamily: glm }, deepseekV4.model)).toEqual({
      ...kimi,
      fallback: glm,
    });
  });

  it("returns null when every configured model shares the writer's family", () => {
    expect(evaluatorStageFor({ ...deepseek, fallback: deepseekV4 }, deepseek.model)).toBeNull();
  });
});
