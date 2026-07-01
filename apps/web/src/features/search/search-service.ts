import { apiFetch } from "@/lib/api/client";

export type SearchEntityType = "ALL" | "TASK" | "USER" | "LEAVE_REQUEST" | "DEPARTMENT";

export interface SearchResult {
  id: string;
  type: Exclude<SearchEntityType, "ALL">;
  title: string;
  subtitle: string;
  url: string;
  highlight: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
}

export interface RecentSearch {
  id: string;
  query: string;
  createdAt: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  entityType: Exclude<SearchEntityType, "ALL">;
  filterJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedFilterPayload {
  name: string;
  entityType: Exclude<SearchEntityType, "ALL">;
  filterJson: Record<string, unknown>;
}

interface ApiContext {
  token: string;
  companyId: string;
}

function queryString(filters: object = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const searchService = {
  search(context: ApiContext, filters: { q: string; type?: SearchEntityType; limit?: number; page?: number }) {
    return apiFetch<SearchResponse>(`/search${queryString(filters)}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  recent(context: ApiContext) {
    return apiFetch<RecentSearch[]>("/search/recent", {
      token: context.token,
      companyId: context.companyId
    });
  },
  savedFilters(context: ApiContext, entityType?: Exclude<SearchEntityType, "ALL">) {
    return apiFetch<SavedFilter[]>(`/saved-filters${queryString({ entityType })}`, {
      token: context.token,
      companyId: context.companyId
    });
  },
  createSavedFilter(context: ApiContext, payload: CreateSavedFilterPayload) {
    return apiFetch<SavedFilter>("/saved-filters", {
      method: "POST",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  updateSavedFilter(context: ApiContext, id: string, payload: Partial<CreateSavedFilterPayload>) {
    return apiFetch<SavedFilter>(`/saved-filters/${id}`, {
      method: "PATCH",
      token: context.token,
      companyId: context.companyId,
      body: JSON.stringify(payload)
    });
  },
  removeSavedFilter(context: ApiContext, id: string) {
    return apiFetch<{ success: true }>(`/saved-filters/${id}`, {
      method: "DELETE",
      token: context.token,
      companyId: context.companyId
    });
  }
};
