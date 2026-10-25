import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Criterion } from "./rubric.js";

/** The evaluator rounds its score to 2 decimals; allow that much drift from the weighted sum. */
const SCORE_TOLERANCE = 0.02;

const isUnitScore = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 1;
const nonEmpty = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/**
 * Validate `eval.json`: a 0-1 score equal to the weighted sum of a 0-1 score per rubric
 * criterion, complete mustFix items, and feedback from every persona plus the brief's audience.
 * Returns an error message, or null when the file is valid.
 */
export function checkEval(runDir: string, criteria: readonly Criterion[], personaCount: number): string | null {
  const path = join(runDir, "eval.json");
  if (!existsSync(path)) return "eval.json was not written";
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return "eval.json is not valid JSON";
  }

  if (!isUnitScore(data.score)) return "eval.json score must be a number from 0 to 1";
  const perCriterion = Array.isArray(data.perCriterion) ? (data.perCriterion as Record<string, unknown>[]) : [];
  const scoreOf = (id: string) => perCriterion.find((c) => c.id === id && isUnitScore(c.score))?.score as number;
  const unscored = criteria.find((c) => scoreOf(c.id) === undefined);
  if (unscored) return `eval.json has no score for ${unscored.id}`;
  const weighted = +criteria.reduce((sum, c) => sum + c.weight * scoreOf(c.id), 0).toFixed(2);
  if (Math.abs(weighted - data.score) > SCORE_TOLERANCE) {
    return `eval.json score ${data.score} does not match the weighted criteria (${weighted})`;
  }

  const mustFix = Array.isArray(data.mustFix) ? (data.mustFix as Record<string, unknown>[]) : null;
  if (!mustFix) return "eval.json mustFix must be a list";
  const incomplete = mustFix.findIndex((m) => !nonEmpty(m.section) || !nonEmpty(m.issue) || !nonEmpty(m.fix));
  if (incomplete >= 0) return `eval.json mustFix item ${incomplete + 1} needs section, issue and fix`;

  const feedback = Array.isArray(data.personaFeedback) ? data.personaFeedback.length : 0;
  if (feedback < personaCount + 1) {
    return `eval.json has ${feedback} persona feedback entries; need ${personaCount + 1}`;
  }
  return null;
}
