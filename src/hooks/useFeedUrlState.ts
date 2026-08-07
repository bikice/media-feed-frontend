import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFeedPreferences } from '@/lib/feedPreferences';
import type { FeedQuery } from '@/types';

const DEFAULT_PROVIDER = 'reddit';
// How long to wait after the last keystroke in the search box before
// committing a new history entry for it. Keeps `back` from having to be
// pressed once per character while still keeping the address bar live.
const QUERY_PUSH_DEBOUNCE_MS = 600;

interface FeedUrlState {
    provider: string;
    query: FeedQuery;
}

/** Read `/:provider?source=...&flair=...&order=...&q=...` from the current
 *  location. Falls back to the last-saved preferences (and then a hard
 *  default) when the URL doesn't carry a provider yet, e.g. a fresh visit
 *  to `/`. */
function parseLocation(): FeedUrlState {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const providerFromPath = segments[0] ? decodeURIComponent(segments[0]) : null;
    const params = new URLSearchParams(window.location.search);
    const query: FeedQuery = {
        q: params.get('q') ?? undefined,
        source: params.get('source') ?? undefined,
        flair: params.get('flair') ?? undefined,
        order: params.get('order') ?? undefined,
    };

    if (providerFromPath) return { provider: providerFromPath, query };

    const prefs = loadFeedPreferences();
    return prefs
        ? { provider: prefs.provider, query: prefs.query }
        : { provider: DEFAULT_PROVIDER, query };
}

function buildUrl(state: FeedUrlState): string {
    const params = new URLSearchParams();
    if (state.query.q) params.set('q', state.query.q);
    if (state.query.source) params.set('source', state.query.source);
    if (state.query.flair) params.set('flair', state.query.flair);
    if (state.query.order) params.set('order', state.query.order);
    const qs = params.toString();
    return `/${encodeURIComponent(state.provider)}${qs ? `?${qs}` : ''}`;
}

function sameNonQueryScope(a: FeedQuery, b: FeedQuery): boolean {
    return a.source === b.source && a.flair === b.flair && a.order === b.order;
}

/**
 * Keeps the URL in sync with { provider, query } so the device/browser back
 * action steps back through feed navigation (provider switches, source/flair
 * picks, sort order, search text) instead of leaving the page.
 *
 * - Provider, source, flair, order changes push a new history entry right
 *   away -- each is a discrete action (tapping a provider, a subreddit, a
 *   flair chip, a sort option).
 * - `q` (free-text search) only replaces the current entry while typing,
 *   and pushes a new one once typing settles for QUERY_PUSH_DEBOUNCE_MS, so
 *   back undoes a finished search rather than one keystroke.
 * - Pressing back/forward is read back in via `popstate` without re-pushing.
 */
export function useFeedUrlState() {
    const [state, setState] = useState<FeedUrlState>(() => parseLocation());

    const isFirstSync = useRef(true);
    const skipNextSync = useRef(false); // set right after a popstate-driven update
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPushed = useRef<FeedUrlState>(state);

    useEffect(() => {
        if (skipNextSync.current) {
            skipNextSync.current = false;
            lastPushed.current = state;
            return;
        }

        const url = buildUrl(state);

        if (isFirstSync.current) {
            // Replace the initial entry so it carries real state instead of
            // whatever bare path the app happened to load on.
            window.history.replaceState(state, '', url);
            isFirstSync.current = false;
            lastPushed.current = state;
            return;
        }

        if (url === window.location.pathname + window.location.search) return;

        const providerChanged = state.provider !== lastPushed.current.provider;
        const scopeChanged = !sameNonQueryScope(state.query, lastPushed.current.query);

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
            debounceTimer.current = null;
        }

        if (providerChanged || scopeChanged) {
            window.history.pushState(state, '', url);
            lastPushed.current = state;
            return;
        }

        // Only `q` differs from what's currently pushed -- keep the address
        // bar live via replace, and debounce the actual history entry.
        window.history.replaceState(state, '', url);
        debounceTimer.current = setTimeout(() => {
            window.history.pushState(state, '', url);
            lastPushed.current = state;
            debounceTimer.current = null;
        }, QUERY_PUSH_DEBOUNCE_MS);
    }, [state]);

    useEffect(() => {
        function onPopState(e: PopStateEvent) {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                debounceTimer.current = null;
            }
            const next: FeedUrlState = e.state ?? parseLocation();
            skipNextSync.current = true;
            setState(next);
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const setProvider = useCallback((provider: string) => {
        setState((prev) => ({ ...prev, provider }));
    }, []);

    const setQuery = useCallback((updater: FeedQuery | ((prev: FeedQuery) => FeedQuery)) => {
        setState((prev) => ({
            ...prev,
            query: typeof updater === 'function' ? (updater as (p: FeedQuery) => FeedQuery)(prev.query) : updater,
        }));
    }, []);

    return { provider: state.provider, query: state.query, setProvider, setQuery };
}