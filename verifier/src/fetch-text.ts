import { createHttpGet } from "../../extensions/web-tools/lib/http.js";
import { fetchPage } from "../../extensions/web-tools/lib/tools.js";
import { withRetry } from "./retry.js";
import type { FetchText } from "./verify.js";

const MAX_PAGE_CHARS = 5_000_000;
const FETCH_TIMEOUT_MS = 60_000;

/** Real page fetcher for verification: HTML or PDF text, 2 retries with backoff on transient errors. */
export function createFetchText(): FetchText {
  const http = createHttpGet(FETCH_TIMEOUT_MS);
  const fetchOnce = async (url: string) => (await fetchPage({ url, maxChars: MAX_PAGE_CHARS, http })).text;
  return withRetry(fetchOnce, { retries: 2, baseDelayMs: 2000 });
}
