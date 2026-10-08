import type { LaravelErrorResponse, LaravelValidationErrors } from '@/lib/types';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

export const API_URL = configuredApiUrl ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly errors: LaravelValidationErrors;
  readonly response: unknown;

  constructor(status: number, payload: unknown) {
    const errorPayload = isLaravelError(payload) ? payload : undefined;
    super(errorPayload?.message || `Request failed with status ${status}.`);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errorPayload?.errors ?? {};
    this.response = payload;
  }
}

function isLaravelError(payload: unknown): payload is LaravelErrorResponse {
  return typeof payload === 'object' && payload !== null;
}

function endpoint(path: string): string {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured. Add it to mobile/.env.');
  }
  return `${API_URL}/${path.replace(/^\/+/, '')}`;
}

/**
 * Resolve a stored asset URL (e.g. `/storage/uploads/images/x.jpg`) to an
 * absolute URL the device can fetch. Absolute URLs pass through untouched.
 * `API_URL` may carry an `/api` suffix, which is stripped to reach the origin.
 */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_URL) return path;
  const origin = API_URL.replace(/\/api\/?$/, '');
  return `${origin}/${path.replace(/^\/+/, '')}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, body, headers, ...init } = options;
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await parseResponse(response);

  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function fieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) ? error.errors[field]?.[0] : undefined;
}

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default apiRequest;