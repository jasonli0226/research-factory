import type { EvaluatorConfig, StageConfig } from "./config.js";

/** The vendor prefix of a model id ("~deepseek/deepseek-flash-latest" → "deepseek"). */
export function modelFamily(model: string): string {
  return model.replace(/^~/, "").split("/")[0]!;
}

/**
 * The evaluator's models, minus any from the writer's family: the evaluator never grades a
 * proposal its own family wrote. The cross-family model goes last. Null when no model is left.
 */
export function evaluatorStageFor(evaluator: EvaluatorConfig, writerModel: string): StageConfig | null {
  const writer = modelFamily(writerModel);
  const [primary, fallback] = [evaluator, evaluator.fallback, evaluator.crossFamily]
    .filter((m) => m !== undefined)
    .filter((m) => modelFamily(m.model) !== writer)
    .map(({ provider, model }) => ({ provider, model }));
  if (!primary) return null;
  return fallback ? { ...primary, fallback } : primary;
}
