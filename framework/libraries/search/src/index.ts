export const packageId = "search" as const;
export const packageDisplayName = "Search" as const;
export const packageDescription = "Search abstraction layer." as const;

export type SearchDocument = {
  id: string;
  title: string;
  body: string;
  tags?: string[] | undefined;
  tenantId?: string | undefined;
};

export type SearchFilter = {
  field: string;
  op: "eq" | "in" | "contains";
  value: string | string[];
};

export type SearchSort = {
  field: "rank" | "updatedAt" | "title";
  direction: "asc" | "desc";
};

export type SearchQuery = {
  text: string;
  filters?: SearchFilter[] | undefined;
  sort?: SearchSort[] | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export type SearchHighlight = {
  field: "title" | "body";
  value: string;
};

export type SearchHit<TDocument extends SearchDocument = SearchDocument> = {
  document: TDocument;
  rank: number;
  highlights: SearchHighlight[];
};

export type SearchResultPage<TDocument extends SearchDocument = SearchDocument> = {
  total: number;
  limit: number;
  offset: number;
  hits: SearchHit<TDocument>[];
};

export type SearchIndexDefinition = {
  id: string;
  table: string;
  searchableFields: Array<keyof SearchDocument>;
  defaultSort: SearchSort[];
};

export type SearchAdapter<TDocument extends SearchDocument = SearchDocument> = {
  search(index: SearchIndexDefinition, query: SearchQuery): Promise<SearchResultPage<TDocument>> | SearchResultPage<TDocument>;
};

export function defineSearchDocument(document: SearchDocument): SearchDocument {
  return Object.freeze({
    ...document,
    ...(document.tags ? { tags: [...document.tags] } : {})
  });
}

export function defineSearchIndex(index: SearchIndexDefinition): SearchIndexDefinition {
  return Object.freeze({
    ...index,
    searchableFields: [...index.searchableFields],
    defaultSort: [...index.defaultSort]
  });
}

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((value) => value.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
}

export function normalizeSearchQuery(query: SearchQuery): SearchQuery {
  return Object.freeze({
    ...query,
    filters: [...(query.filters ?? [])].sort((left, right) => left.field.localeCompare(right.field)),
    sort: [...(query.sort ?? [{ field: "rank", direction: "desc" }])],
    limit: Math.min(Math.max(query.limit ?? 20, 1), 100),
    offset: Math.max(query.offset ?? 0, 0)
  });
}

export function buildPostgresTsQuery(text: string): string {
  return tokenizeSearchQuery(text)
    .map((token) => `${token}:*`)
    .join(" & ");
}

export function highlightSearchText(text: string, tokens: string[]): string {
  return tokens.reduce((accumulator, token) => {
    const expression = new RegExp(`(${escapeRegExp(token)})`, "giu");
    return accumulator.replace(expression, "<mark>$1</mark>");
  }, text);
}

export function scoreSearchHit(document: SearchDocument, tokens: string[]): number {
  return tokens.reduce((score, token) => {
    const normalizedToken = token.toLowerCase();
    const titleMatch = document.title.toLowerCase().includes(normalizedToken) ? 4 : 0;
    const bodyMatch = document.body.toLowerCase().includes(normalizedToken) ? 2 : 0;
    const tagMatch = document.tags?.some((tag) => tag.toLowerCase().includes(normalizedToken)) ? 1 : 0;
    return score + titleMatch + bodyMatch + (tagMatch ? 1 : 0);
  }, 0);
}

export function createSearchResultPage<TDocument extends SearchDocument>(
  query: SearchQuery,
  hits: SearchHit<TDocument>[],
  total: number
): SearchResultPage<TDocument> {
  const normalized = normalizeSearchQuery(query);
  return Object.freeze({
    total,
    limit: normalized.limit ?? 20,
    offset: normalized.offset ?? 0,
    hits
  });
}

export async function runSearch<TDocument extends SearchDocument>(
  adapter: SearchAdapter<TDocument>,
  index: SearchIndexDefinition,
  query: SearchQuery
): Promise<SearchResultPage<TDocument>> {
  return adapter.search(index, normalizeSearchQuery(query));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
