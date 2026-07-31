const TOKEN_KEY = 'mediafeed.token';
const REFRESH_KEY = 'mediafeed.refreshToken';

export interface StoredTokens {
  token: string | null;
  refreshToken: string | null;
}

export function loadTokens(): StoredTokens {
  try {
    return {
      token: localStorage.getItem(TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
    };
  } catch {
    return { token: null, refreshToken: null };
  }
}

export function saveTokens(tokens: StoredTokens): void {
  try {
    if (tokens.token) localStorage.setItem(TOKEN_KEY, tokens.token);
    else localStorage.removeItem(TOKEN_KEY);

    if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Storage unavailable (private mode, quota, etc). Session just won't persist.
  }
}

export function clearTokens(): void {
  saveTokens({ token: null, refreshToken: null });
}
