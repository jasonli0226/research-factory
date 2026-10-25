import { readFileSync } from "node:fs";
import { z } from "zod";

const ModelSchema = z.object({ provider: z.string().min(1), model: z.string().min(1) });
const StageSchema = ModelSchema.extend({ fallback: ModelSchema.optional() });
/** The evaluator also names a model to use when the writer shares its family. */
const EvaluatorSchema = StageSchema.extend({ crossFamily: ModelSchema.optional() });

export const ConfigSchema = z.object({
  stages: z.object({
    planner: StageSchema,
    researcher: StageSchema,
    synthesizer: StageSchema,
    "solution-generator": StageSchema,
    "red-team": StageSchema,
    "proposal-writer": StageSchema,
    evaluator: EvaluatorSchema,
  }),
  budgets: z.object({
    maxRevisionRounds: z.number().int().min(0),
    maxRepairRounds: z.number().int().min(0),
    maxParallelResearchers: z.number().int().min(1),
    maxUsdPerRun: z.number().positive(),
    stageTimeoutSec: z.number().int().positive(),
  }),
  thresholds: z.object({
    minEvalScore: z.number().min(0).max(1),
    minVerifiedCitationRatio: z.number().min(0).max(1),
  }),
});

export type FactoryConfig = z.infer<typeof ConfigSchema>;
export type StageConfig = z.infer<typeof StageSchema>;
export type EvaluatorConfig = z.infer<typeof EvaluatorSchema>;

export function parseConfig(data: unknown): FactoryConfig {
  const parsed = ConfigSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid factory config: ${issues}`);
  }
  return parsed.data;
}

export function loadConfig(path: string): FactoryConfig {
  return parseConfig(JSON.parse(readFileSync(path, "utf8")));
}
