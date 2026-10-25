// Verifier CLI: checks every notes/<id>.sources.json in a run directory and writes verification.json.
// Usage: npm run verify -- runs/<run-id>
// Exit code: 0 when the gate passes, 1 when it fails, 2 on usage or config errors.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createFetchText } from "./fetch-text.js";
import { verifyRun, type VerificationReport } from "./verify.js";

const CONFIG_PATH = resolve(import.meta.dirname, "../../config/factory.json");

function readMinRatio(): number {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as { thresholds?: { minVerifiedCitationRatio?: unknown } };
  const ratio = config.thresholds?.minVerifiedCitationRatio;
  if (typeof ratio !== "number" || ratio < 0 || ratio > 1) {
    throw new Error(`thresholds.minVerifiedCitationRatio in ${CONFIG_PATH} must be a number between 0 and 1`);
  }
  return ratio;
}

function printReport(report: VerificationReport): void {
  for (const [qid, q] of Object.entries(report.questions)) {
    const ok = q.results.filter((r) => r.status === "exact" || r.status === "loose").length;
    console.log(`${q.passed ? "PASS" : "FAIL"}  ${qid}  ${ok}/${q.results.length} quotes verified`);
    for (const error of q.errors) console.log(`      error: ${error}`);
    for (const r of q.results.filter((r) => r.status === "not_found" || r.status === "fetch_failed")) {
      console.log(`      ${r.id} ${r.status}${r.error ? ` (${r.error})` : ""}  ${r.url}`);
    }
    if (q.markers.unused.length > 0) console.log(`      warning: unused sources ${q.markers.unused.join(", ")}`);
  }
  const s = report.summary;
  console.log(
    `\n${s.passed ? "GATE PASSED" : "GATE FAILED"}: ${s.exact} exact + ${s.loose} loose of ${s.total} ` +
      `(${(s.ratio * 100).toFixed(0)}%, need ${(report.minVerifiedRatio * 100).toFixed(0)}% per question); ` +
      `${s.notFound} not found, ${s.fetchFailed} fetch failed`,
  );
}

async function main(): Promise<number> {
  const runArg = process.argv[2];
  if (!runArg) {
    console.error("Usage: npm run verify -- runs/<run-id>");
    return 2;
  }
  const runDir = resolve(runArg);
  if (!existsSync(join(runDir, "notes"))) {
    console.error(`No notes/ directory in ${runDir}`);
    return 2;
  }
  const report = await verifyRun(runDir, { minVerifiedRatio: readMinRatio(), fetchText: createFetchText() });
  writeFileSync(join(runDir, "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  printReport(report);
  return report.summary.passed ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`Verifier error: ${(err as Error).message}`);
    process.exit(2);
  },
);
