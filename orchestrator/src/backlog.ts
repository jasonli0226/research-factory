/** Sub-question ids (Q1, Q2, ...) from the "## Qn: title" headings in backlog.md. */
export function parseBacklogIds(markdown: string): string[] {
  const ids = [...markdown.matchAll(/^##\s+(Q\d+)\b/gm)].map((m) => m[1]!);
  return [...new Set(ids)];
}
