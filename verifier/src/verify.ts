import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { matchQuote } from "./quote.js";
import { findMarkerIssues, parseSourcesFile, type Source } from "./sources.js";

export type FetchText = (url: string) => Promise<string>;
export type QuoteStatus = "exact" | "loose" | "not_found" | "fetch_failed";

export interface QuoteResult {
  readonly id: string;
  readonly url: string;
  readonly status: QuoteStatus;
  readonly error?: string;
}

export interface QuestionReport {
  readonly passed: boolean;
  readonly ratio: number;
  readonly errors: string[];
  readonly markers: { missing: string[]; unused: string[] };
  readonly results: QuoteResult[];
}

export interface Summary {
  readonly questions: number;
  readonly total: number;
  readonly exact: number;
  readonly loose: number;
  readonly notFound: number;
  readonly fetchFailed: number;
  readonly ratio: number;
  readonly passed: boolean;
}

export interface VerificationReport {
  readonly checkedAt: string;
  readonly minVerifiedRatio: number;
  readonly summary: Summary;
  readonly questions: Record<string, QuestionReport>;
}

export interface VerifyOptions {
  readonly fetchText: FetchText;
  readonly minVerifiedRatio: number;
  readonly concurrency?: number;
  /** Only verify these question ids; default is every question in notes/. */
  readonly questionIds?: readonly string[];
}

type PageResult = { ok: true; text: string } | { ok: false; error: string };

/** Fetch each URL at most once, with at most `limit` requests in flight. */
function createPageCache(fetchText: FetchText, limit: number): (url: string) => Promise<PageResult> {
  const cache = new Map<string, Promise<PageResult>>();
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = () => (active < limit ? (active++, Promise.resolve()) : new Promise<void>((r) => waiting.push(r)));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  return (url) => {
    const cached = cache.get(url);
    if (cached) return cached;
    const pending = acquire().then(async (): Promise<PageResult> => {
      try {
        return { ok: true, text: await fetchText(url) };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      } finally {
        release();
      }
    });
    cache.set(url, pending);
    return pending;
  };
}

function listQuestionIds(notesDir: string): string[] {
  if (!existsSync(notesDir)) return [];
  const stems = readdirSync(notesDir)
    .map((name) => /^(.+?)(\.sources\.json|\.md)$/.exec(name)?.[1])
    .filter((stem): stem is string => stem !== undefined);
  return [...new Set(stems)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function checkQuote(source: Source, getPage: (url: string) => Promise<PageResult>): Promise<QuoteResult> {
  const page = await getPage(source.url);
  if (!page.ok) return { id: source.id, url: source.url, status: "fetch_failed", error: page.error };
  const match = matchQuote(page.text, source.quote);
  return { id: source.id, url: source.url, status: match ?? "not_found" };
}

async function verifyQuestion(
  notesDir: string,
  qid: string,
  getPage: (url: string) => Promise<PageResult>,
  minVerifiedRatio: number,
): Promise<QuestionReport> {
  const notesPath = join(notesDir, `${qid}.md`);
  const sourcesPath = join(notesDir, `${qid}.sources.json`);
  const notes = existsSync(notesPath) ? readFileSync(notesPath, "utf8") : "";
  const empty = { missing: [], unused: [] };

  if (!existsSync(notesPath)) return { passed: false, ratio: 0, errors: [`Missing ${qid}.md`], markers: empty, results: [] };
  if (!existsSync(sourcesPath)) {
    return { passed: false, ratio: 0, errors: [`Missing ${qid}.sources.json`], markers: empty, results: [] };
  }
  const parsed = parseSourcesFile(readFileSync(sourcesPath, "utf8"));
  if (!parsed.ok) return { passed: false, ratio: 0, errors: parsed.errors, markers: empty, results: [] };

  const markers = findMarkerIssues(notes, parsed.sources.map((s) => s.id));
  const results = await Promise.all(parsed.sources.map((s) => checkQuote(s, getPage)));
  const verified = results.filter((r) => r.status === "exact" || r.status === "loose").length;
  const ratio = results.length === 0 ? 0 : verified / results.length;
  const errors = [
    ...(results.length === 0 ? ["No sources"] : []),
    ...markers.missing.map((id) => `Marker [${id}] has no source entry`),
  ];
  return { passed: errors.length === 0 && ratio >= minVerifiedRatio, ratio, errors, markers, results };
}

function summarize(questions: Record<string, QuestionReport>): Summary {
  const all = Object.values(questions);
  const results = all.flatMap((q) => q.results);
  const count = (status: QuoteStatus) => results.filter((r) => r.status === status).length;
  const exact = count("exact");
  const loose = count("loose");
  return {
    questions: all.length,
    total: results.length,
    exact,
    loose,
    notFound: count("not_found"),
    fetchFailed: count("fetch_failed"),
    ratio: results.length === 0 ? 0 : (exact + loose) / results.length,
    passed: all.length > 0 && all.every((q) => q.passed),
  };
}

/** Verify every notes/<id>.sources.json in a run directory. */
export async function verifyRun(runDir: string, options: VerifyOptions): Promise<VerificationReport> {
  const notesDir = join(runDir, "notes");
  const getPage = createPageCache(options.fetchText, options.concurrency ?? 4);
  const ids = options.questionIds ? [...options.questionIds] : listQuestionIds(notesDir);
  const reports = await Promise.all(ids.map((id) => verifyQuestion(notesDir, id, getPage, options.minVerifiedRatio)));
  const questions = Object.fromEntries(ids.map((id, i) => [id, reports[i]!]));
  return {
    checkedAt: new Date().toISOString(),
    minVerifiedRatio: options.minVerifiedRatio,
    summary: summarize(questions),
    questions,
  };
}
