import axios from 'axios'

const TOKEN_KEY = 'auth_token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token)

export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * A 401 means the stored token is missing, expired or revoked — e.g. the
 * `PUT /api/password` route revokes every *other* token for that user. Clearing
 * it here makes the whole app fall back to the login screen instead of every
 * page quietly firing doomed requests with a token the backend already rejects.
 *
 * Note `POST /login` answers bad credentials with a 422 ValidationException, not
 * a 401, so this cannot wipe the session during a normal sign-in attempt.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken()
    }
    return Promise.reject(error)
  },
)

/**
 * Normalised view of a failed request.
 *
 * Laravel renders a ValidationException as 422 with
 * `{ message, errors: { field: [messages] } }`. Network failures, 403, 404, 429
 * and 500 arrive as a bare `message`. Pages used to walk the axios error by hand
 * at every call site, which is how a non-field 422 (delete keyed `user`) ended
 * up surfacing as `alert(undefined)`.
 */
export interface ApiError {
  status: number
  message: string
  errors: Record<string, string[]>
}

export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0

    // status 0 means the request never reached a server: backend down, or the
    // Vite proxy target on :8000 is not listening.
    if (status === 0) {
      return {
        status,
        message: 'Cannot reach the server. Is the backend running on port 8000?',
        errors: {},
      }
    }

    const data = err.response?.data
    if (data && typeof data === 'object') {
      const body = data as { message?: string; errors?: Record<string, string[]> }
      return {
        status,
        message: body.message ?? `Request failed (${status}).`,
        errors: body.errors ?? {},
      }
    }

    return { status, message: `Request failed (${status}).`, errors: {} }
  }

  return {
    status: 0,
    message: err instanceof Error ? err.message : 'Request failed.',
    errors: {},
  }
}

/**
 * First message per field, shaped for direct use as form error state.
 *
 * When the response carries field errors they are returned keyed by field name.
 * Anything else (403 Forbidden, 429 throttled, 500, network down) collapses to
 * `{ form: message }` so a page can always render it somewhere.
 */
export function fieldError(err: unknown): Record<string, string> {
  const { errors, message } = toApiError(err)

  if (Object.keys(errors).length > 0) {
    return Object.fromEntries(
      Object.entries(errors).map(([key, value]) => [key, value[0] ?? '']),
    )
  }

  return { form: message }
}

export default apiClient
