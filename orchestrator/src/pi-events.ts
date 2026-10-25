export interface PiOutcome {
  readonly ok: boolean;
  readonly costUsd: number;
  readonly finalText: string;
  readonly error?: string;
}

interface AssistantMessage {
  role?: string;
  stopReason?: string;
  errorMessage?: string;
  content?: { type?: string; text?: string }[] | string;
  usage?: { cost?: { total?: number } };
}

function parseLine(line: string): { type?: string; message?: AssistantMessage } | null {
  try {
    return JSON.parse(line) as { type?: string; message?: AssistantMessage };
  } catch {
    return null;
  }
}

function textOf(message: AssistantMessage): string {
  if (typeof message.content === "string") return message.content;
  return (message.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

/** Summarize a pi --mode json stream. pi exits 0 on provider errors, so the final stop reason decides success. */
export function parsePiEvents(jsonl: string): PiOutcome {
  const assistants = jsonl
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0)
    .map(parseLine)
    .filter((e) => e?.type === "message_end" && e.message?.role === "assistant")
    .map((e) => e!.message!);

  const costUsd = assistants.reduce((sum, m) => sum + (m.usage?.cost?.total ?? 0), 0);
  const last = assistants.at(-1);
  if (!last) return { ok: false, costUsd, finalText: "", error: "pi produced no assistant message" };
  if (last.stopReason === "error" || last.stopReason === "aborted") {
    return { ok: false, costUsd, finalText: textOf(last), error: last.errorMessage ?? `stopped: ${last.stopReason}` };
  }
  return { ok: true, costUsd, finalText: textOf(last) };
}
