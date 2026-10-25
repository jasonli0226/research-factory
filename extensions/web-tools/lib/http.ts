import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";
import type { HttpGet } from "./tools.js";

// Node's default 250 ms per connection attempt aborts connections to slow or distant servers
// (seen: 500 ms TCP connect fails with UND_ERR_CONNECT_TIMEOUT while curl succeeds).
const CONNECT_ATTEMPT_TIMEOUT_MS = 2000;
setDefaultAutoSelectFamilyAttemptTimeout(CONNECT_ATTEMPT_TIMEOUT_MS);

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) research-factory/0.1";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 20 * 1024 * 1024;

/** Real HTTP GET with timeout and body-size guard. */
export function createHttpGet(timeoutMs = DEFAULT_TIMEOUT_MS): HttpGet {
  return async (url, signal) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json;q=0.9,application/pdf;q=0.9,*/*;q=0.8" },
      redirect: "follow",
      signal: combined,
    });
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) throw new Error(`Response too large (${declared} bytes)`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BODY_BYTES) throw new Error(`Response too large (${bytes.byteLength} bytes)`);
    return {
      status: res.status,
      bytes,
      contentType: res.headers.get("content-type") ?? "",
      finalUrl: res.url || url,
    };
  };
}
