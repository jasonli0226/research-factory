import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface RoundResult {
  readonly round: number;
  readonly score: number;
  readonly mustFix: number;
}

export type RevisionStatus = "accepted" | "below-threshold" | "writer-failed" | "evaluator-failed";

export interface RevisionOutcome {
  readonly status: RevisionStatus;
  readonly rounds: RoundResult[];
  readonly bestRound?: number;
}

export interface RevisionDeps {
  readonly runDir: string;
  readonly maxRevisionRounds: number;
  readonly minEvalScore: number;
  /** Write proposal.md: round 0 drafts it, later rounds revise it from eval.json. */
  readonly writeProposal: (round: number) => Promise<boolean>;
  /** Score proposal.md into eval.json. */
  readonly evaluate: () => Promise<boolean>;
  readonly log?: (message: string) => void;
}

/** Fewer mustFix items first, then the higher score, then the later round. */
const better = (a: RoundResult, b: RoundResult) =>
  a.mustFix !== b.mustFix ? a.mustFix < b.mustFix : a.score !== b.score ? a.score > b.score : a.round > b.round;

/**
 * Draft, evaluate and revise proposal.md until a draft meets `minEvalScore` with no mustFix items,
 * for at most `maxRevisionRounds` revisions. Each round's files are kept in `rounds/`; the best
 * round's proposal.md and eval.json are left in the run directory.
 */
export async function reviseUntilAccepted(deps: RevisionDeps): Promise<RevisionOutcome> {
  const { runDir, log = () => {} } = deps;
  const roundsDir = join(runDir, "rounds");
  mkdirSync(roundsDir, { recursive: true });
  const archived = (file: "proposal" | "eval", round: number) =>
    join(roundsDir, file === "proposal" ? `proposal.${round}.md` : `eval.${round}.json`);
  const restore = (round: number) => {
    copyFileSync(archived("proposal", round), join(runDir, "proposal.md"));
    copyFileSync(archived("eval", round), join(runDir, "eval.json"));
  };

  const rounds: RoundResult[] = [];
  let best: RoundResult | undefined;
  for (let round = 0; round <= deps.maxRevisionRounds; round++) {
    if (best) restore(best.round);
    if (!(await deps.writeProposal(round))) {
      if (!best) return { status: "writer-failed", rounds };
      break;
    }
    if (!(await deps.evaluate())) {
      if (!best) return { status: "evaluator-failed", rounds };
      break;
    }
    copyFileSync(join(runDir, "proposal.md"), archived("proposal", round));
    copyFileSync(join(runDir, "eval.json"), archived("eval", round));
    const evaluation = JSON.parse(readFileSync(join(runDir, "eval.json"), "utf8"));
    const result = { round, score: evaluation.score, mustFix: evaluation.mustFix.length };
    rounds.push(result);
    log(`  round ${round}: score ${result.score}, ${result.mustFix} must-fix item(s)`);
    if (!best || better(result, best)) best = result;
    if (result.score >= deps.minEvalScore && result.mustFix === 0) {
      restore(round);
      return { status: "accepted", rounds, bestRound: round };
    }
  }
  restore(best!.round);
  return { status: "below-threshold", rounds, bestRound: best!.round };
}
