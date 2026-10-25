export interface CostTracker {
  add(usd: number): void;
  spent(): number;
  exhausted(): boolean;
}

/** Running total of model spend for one factory run. */
export function createCostTracker(limitUsd: number): CostTracker {
  let total = 0;
  return {
    add: (usd) => {
      total += usd;
    },
    spent: () => total,
    exhausted: () => total >= limitUsd,
  };
}
