import type { ApiError } from "@taskflow/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiOptions extends RequestInit {
  token?: string | null;
  companyId?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  if (options.companyId) {
    headers.set("x-company-id", options.companyId);
  }

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(error?.message ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
