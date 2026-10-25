export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
  readonly source: string;
}

export interface Paper {
  readonly title: string;
  readonly year: number | null;
  readonly url: string;
  readonly authors: readonly string[];
  readonly citedBy: number;
  readonly abstract: string;
}
