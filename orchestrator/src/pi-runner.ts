import { spawn } from "node:child_process";
import { parsePiEvents, type PiOutcome } from "./pi-events.js";

export interface PiInvocation {
  readonly cwd: string;
  readonly skillDir: string;
  readonly extensions: readonly string[];
  readonly tools: readonly string[];
  readonly provider: string;
  readonly model: string;
  readonly prompt: string;
  readonly sessionDir: string;
  readonly timeoutMs: number;
}

export type PiResult = PiOutcome;
export type PiRunner = (invocation: PiInvocation) => Promise<PiResult>;

export function buildPiArgs(inv: PiInvocation): string[] {
  return [
    "-p",
    "--mode", "json",
    "--session-dir", inv.sessionDir,
    "--no-context-files",
    "--no-skills",
    "--skill", inv.skillDir,
    ...inv.extensions.flatMap((e) => ["--extension", e]),
    "--tools", inv.tools.join(","),
    "--provider", inv.provider,
    "--model", inv.model,
    ...(inv.prompt.startsWith("-") ? ["--", inv.prompt] : [inv.prompt]),
  ];
}

const MAX_STDERR_CHARS = 2000;

/** Run pi as a child process and summarize its JSON event stream. */
export function createPiRunner(piBinary = "pi"): PiRunner {
  return (inv) =>
    new Promise((resolve) => {
      const child = spawn(piBinary, buildPiArgs(inv), { cwd: inv.cwd, stdio: ["ignore", "pipe", "pipe"] });
      const stdout: Buffer[] = [];
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, inv.timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString("utf8")).slice(-MAX_STDERR_CHARS);
      });
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ ok: false, costUsd: 0, finalText: "", error: `Could not start pi: ${err.message}` });
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const outcome = parsePiEvents(Buffer.concat(stdout).toString("utf8"));
        if (timedOut) resolve({ ...outcome, ok: false, error: `Timed out after ${inv.timeoutMs} ms` });
        else if (code !== 0) resolve({ ...outcome, ok: false, error: `pi exited ${code}: ${stderr.trim() || outcome.error}` });
        else resolve(outcome);
      });
    });
}
