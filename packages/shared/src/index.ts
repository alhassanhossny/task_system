export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

export function toApiEnvelope<T>(data: T, meta?: Record<string, unknown>): ApiEnvelope<T> {
  return meta ? { data, meta } : { data };
}
