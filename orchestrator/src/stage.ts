import type { CostTracker } from "./budget.js";
import type { StageConfig } from "./config.js";
import type { PiInvocation, PiRunner } from "./pi-runner.js";

export interface Attempt {
  readonly model: string;
  readonly costUsd: number;
  readonly error?: string;
}

export interface StageResult {
  readonly ok: boolean;
  readonly model?: string;
  readonly error?: string;
  readonly attempts: Attempt[];
}

export interface RunStageOptions {
  readonly name: string;
  readonly stage: StageConfig;
  readonly invocation: Omit<PiInvocation, "provider" | "model">;
  readonly runner: PiRunner;
  readonly costs: CostTracker;
  /** Returns an error message when the stage's output files are missing or invalid. */
  readonly validate: () => string | null;
}

/** The task prompt plus why the previous attempt's output failed its check, so the model can fix it. */
export function withCheckFeedback(prompt: string, checkError: string): string {
  return (
    `${prompt}\n\nA previous attempt at this task wrote output that failed this check:\n${checkError}\n` +
    "Write the output again with exactly these problems fixed, keeping everything else that was correct."
  );
}

/**
 * Primary model, one retry, then the fallback model if configured. An attempt after a failed
 * output check is told the check's error; a provider error is retried with the original prompt.
 */
export async function runStage(opts: RunStageOptions): Promise<StageResult> {
  const plan = [opts.stage, opts.stage, ...(opts.stage.fallback ? [opts.stage.fallback] : [])];
  const attempts: Attempt[] = [];
  let checkError: string | undefined;

  for (const target of plan) {
    if (opts.costs.exhausted()) {
      return { ok: false, error: "Budget exhausted", attempts };
    }
    let error: string | undefined;
    let costUsd = 0;
    const prompt = checkError ? withCheckFeedback(opts.invocation.prompt, checkError) : opts.invocation.prompt;
    try {
      const result = await opts.runner({ ...opts.invocation, prompt, provider: target.provider, model: target.model });
      costUsd = result.costUsd;
      error = result.ok ? (opts.validate() ?? undefined) : result.error;
      checkError = result.ok ? error : checkError;
    } catch (err) {
      error = (err as Error).message;
    }
    opts.costs.add(costUsd);
    attempts.push({ model: target.model, costUsd, ...(error ? { error } : {}) });
    if (!error) return { ok: true, model: target.model, attempts };
  }
  return { ok: false, error: attempts.at(-1)?.error ?? "No attempts made", attempts };
}
