import { z } from "zod";

export const SourceSchema = z.object({
  id: z.string().regex(/^S\d+$/, "id must look like S1, S2, ..."),
  url: z.url({ protocol: /^https?$/, error: "url must be an http(s) URL" }),
  quote: z.string().trim().min(1, "quote must not be empty"),
  claim: z.string(),
});

export type Source = z.infer<typeof SourceSchema>;

export type ParseResult = { ok: true; sources: Source[] } | { ok: false; errors: string[] };

export function parseSourcesFile(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { ok: false, errors: [`Invalid JSON: ${(err as Error).message}`] };
  }
  const parsed = z.array(SourceSchema).safeParse(data);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  const seen = new Set<string>();
  const duplicates = parsed.data.filter((s) => (seen.has(s.id) ? true : (seen.add(s.id), false)));
  if (duplicates.length > 0) {
    return { ok: false, errors: [...new Set(duplicates.map((s) => `Duplicate id ${s.id}`))] };
  }
  return { ok: true, sources: parsed.data };
}

/** Citation markers like [S1] or [S1, S2] in notes, compared with the source ids. */
export function findMarkerIssues(notes: string, sourceIds: readonly string[]): { missing: string[]; unused: string[] } {
  const cited = [...notes.matchAll(/\[(S\d+(?:\s*,\s*S\d+)*)\]/g)].flatMap((m) => m[1]!.split(/\s*,\s*/));
  const citedSet = new Set(cited);
  const known = new Set(sourceIds);
  return {
    missing: [...new Set(cited.filter((id) => !known.has(id)))],
    unused: sourceIds.filter((id) => !citedSet.has(id)),
  };
}
