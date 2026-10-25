export interface RetryOptions {
  readonly retries: number;
  readonly baseDelayMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

// Errors that will not change on retry: missing pages and unsupported content.
const PERMANENT = /HTTP (400|401|404|405|410|451)\b|Unsupported content type|Only http\(s\) URLs|Could not read PDF/;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wrap an async function so transient failures are retried with exponential backoff. */
export function withRetry<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: RetryOptions) {
  const sleep = options.sleep ?? defaultSleep;
  return async (...args: A): Promise<R> => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        const permanent = PERMANENT.test((err as Error).message);
        if (permanent || attempt >= options.retries) throw err;
        await sleep(options.baseDelayMs * 2 ** attempt);
      }
    }
  };
}
