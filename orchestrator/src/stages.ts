export const STAGES = [
  "planner",
  "researcher",
  "synthesizer",
  "solution-generator",
  "red-team",
  "proposal-writer",
  "evaluator",
] as const;

export type Stage = (typeof STAGES)[number];
