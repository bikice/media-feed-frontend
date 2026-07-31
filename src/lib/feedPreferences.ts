import type { FeedQuery } from '@/types';

const PREFS_KEY = 'mediafeed.feedPrefs';

export interface FeedPreferences {
    provider: string;
    query: FeedQuery;
}

/** Load the last-used provider + query filters, if any were saved. */
export function loadFeedPreferences(): FeedPreferences | null {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || typeof parsed.provider !== 'string') return null;
        return {
            provider: parsed.provider,
            query: parsed.query && typeof parsed.query === 'object' ? parsed.query : {},
        };
    } catch {
        return null;
    }
}

/** Persist the current provider + query filters so a reload can resume them. */
export function saveFeedPreferences(prefs: FeedPreferences): void {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // Storage unavailable (private mode, quota, etc). Selection just won't persist.
    }
}