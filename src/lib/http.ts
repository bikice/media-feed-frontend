import { loadTokens, saveTokens, clearTokens } from './tokenStorage';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

type Listener = () => void;

/**
 * Tiny pub/sub so useAuth (and anything else) can react when the session
 * is torn down as a side effect of a failed refresh, without http.ts
 * importing React.
 */
const sessionExpiredListeners = new Set<Listener>();
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}
function notifySessionExpired() {
  clearTokens();
  sessionExpiredListeners.forEach((l) => l());
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = loadTokens();
  if (!refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch('/api/token/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          notifySessionExpired();
          return null;
        }
        const data = await res.json();
        saveTokens({ token: data.token, refreshToken: data.refresh_token ?? refreshToken });
        return data.token as string;
      } catch {
        notifySessionExpired();
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions extends RequestInit {
  /** Skip attaching the Authorization header (e.g. for /api/login_check). */
  skipAuth?: boolean;
  /** Skip the 401 -> refresh -> retry dance (used by the refresh call itself). */
  skipRefreshRetry?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, skipRefreshRetry, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const finalHeaders = new Headers(headers);
    finalHeaders.set('Accept', 'application/json');
    if (rest.body && !finalHeaders.has('Content-Type')) {
      finalHeaders.set('Content-Type', 'application/json');
    }
    if (!skipAuth) {
      const { token } = loadTokens();
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }
    return fetch(path, { ...rest, headers: finalHeaders });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth && !skipRefreshRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || body['hydra:description'] || message;
    } catch {
      // response wasn't JSON, keep the generic message
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Build a query string, skipping undefined/null/empty values. */
export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const str = sp.toString();
  return str ? `?${str}` : '';
}
