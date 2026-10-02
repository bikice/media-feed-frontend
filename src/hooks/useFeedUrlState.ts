import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFeedPreferences } from '@/lib/feedPreferences';
import type { FeedQuery } from '@/types';

const DEFAULT_PROVIDER = 'reddit';
// How long to wait after the last keystroke in the search box before
// committing a new history entry for it. Keeps `back` from having to be
// pressed once per character while still keeping the address bar live.
const QUERY_PUSH_DEBOUNCE_MS = 600;

/** Where inside a feed the user was, as carried in the URL.
 *
 *  - `item`   -- id of the active MediaItem. The authoritative anchor: the
 *                feed is provider-ranked and append-only, so a bare index
 *                would point at a different item on the next load.
 *  - `galleryIndex` -- active slide of a multi-image item (omitted when 0).
 *  - `cursor` -- the `after` cursor that was used to fetch the page `item`
 *                came from. This is the "pagination" half: a cold restore
 *                can jump straight to that page instead of replaying every
 *                page from the start. */
export interface FeedPosition {
    item?: string;
    galleryIndex?: number;
    cursor?: string;
}

interface FeedUrlState {
    provider: string;
    query: FeedQuery;
    position: FeedPosition;
}

/** Read `/:provider?source=...&flair=...&order=...&q=...&item=...&g=...&cursor=...`
 *  from the current location. Falls back to the last-saved preferences (and
 *  then a hard default) when the URL doesn't carry a provider yet, e.g. a
 *  fresh visit to `/`. */
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
    const rawGallery = params.get('g');
    const galleryIndex = rawGallery !== null ? Number(rawGallery) : NaN;
    const position: FeedPosition = {
        item: params.get('item') ?? undefined,
        galleryIndex: Number.isFinite(galleryIndex) && galleryIndex > 0 ? galleryIndex : undefined,
        cursor: params.get('cursor') ?? undefined,
    };

    if (providerFromPath) return { provider: providerFromPath, query, position };

    const prefs = loadFeedPreferences();
    return prefs
        ? { provider: prefs.provider, query: prefs.query, position }
        : { provider: DEFAULT_PROVIDER, query, position };
}

function buildUrl(state: FeedUrlState): string {
    const params = new URLSearchParams();
    if (state.query.q) params.set('q', state.query.q);
    if (state.query.source) params.set('source', state.query.source);
    if (state.query.flair) params.set('flair', state.query.flair);
    if (state.query.order) params.set('order', state.query.order);
    if (state.position.item) params.set('item', state.position.item);
    if (state.position.galleryIndex) params.set('g', String(state.position.galleryIndex));
    if (state.position.cursor) params.set('cursor', state.position.cursor);
    const qs = params.toString();
    return `/${encodeURIComponent(state.provider)}${qs ? `?${qs}` : ''}`;
}

function sameNonQueryScope(a: FeedQuery, b: FeedQuery): boolean {
    return a.source === b.source && a.flair === b.flair && a.order === b.order;
}

function samePosition(a: FeedPosition, b: FeedPosition): boolean {
    return a.item === b.item && a.galleryIndex === b.galleryIndex && a.cursor === b.cursor;
}

/**
 * Keeps the URL in sync with { provider, query, position } so the
 * device/browser back action steps back through feed navigation (provider
 * switches, source/flair picks, sort order, search text) instead of leaving
 * the page -- and lands back on the exact item the user was looking at.
 *
 * - Provider, source, flair, order changes push a new history entry right
 *   away -- each is a discrete action (tapping a provider, a subreddit, a
 *   flair chip, a sort option).
 * - `q` (free-text search) only replaces the current entry while typing,
 *   and pushes a new one once typing settles for QUERY_PUSH_DEBOUNCE_MS, so
 *   back undoes a finished search rather than one keystroke.
 * - `position` (active item + gallery slide + page cursor) *never* pushes.
 *   It changes on every swipe, so pushing would turn back into
 *   one-press-per-item. It only replaces the current entry, which means the
 *   entry a later back lands on remembers where the user was in that feed.
 * - Pressing back/forward is read back in via `popstate` without re-pushing.
 */
export function useFeedUrlState() {
    const [state, setState] = useState<FeedUrlState>(() => parseLocation());

    const isFirstSync = useRef(true);
    const skipNextSync = useRef(false); // set right after a popstate-driven update
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPushed = useRef<FeedUrlState>(state);
    // The position the app booted with -- consumers restore from this once
    // and must not see it change underneath them as the user then scrolls.
    const initialPosition = useRef<FeedPosition>(state.position);
    // Bumped on every back/forward press. Consumers use it to re-run their
    // restore even when provider/query happen to be unchanged -- a back can
    // land on an entry that differs only in `position`, and without this
    // nothing would react to it (the feed would keep showing wherever the
    // user had scrolled to, instead of the remembered item and its page).
    const [restoreToken, setRestoreToken] = useState(0);

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
        const queryChanged = state.query.q !== lastPushed.current.query.q;
        const positionChanged = !samePosition(state.position, lastPushed.current.position);

        if (positionChanged && !providerChanged && !scopeChanged && !queryChanged) {
            // Pure scroll/slide movement: keep the current entry up to date so
            // a future back returns here, but never add an entry for it.
            window.history.replaceState(state, '', url);
            lastPushed.current = state;
            return;
        }

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
            // The URL is the authoritative record of the popped entry: it is
            // always present and complete, whereas `e.state` is a structured
            // clone the engine may hand back empty (seen in the Android
            // WebView), which would silently drop the position and leave the
            // feed opening at the top of the listing. Only fall back to
            // `e.state` when the path carries no provider at all.
            const hasProviderPath = window.location.pathname.split('/').filter(Boolean).length > 0;
            const next: FeedUrlState = hasProviderPath ? parseLocation() : (e.state ?? parseLocation());
            skipNextSync.current = true;
            initialPosition.current = next.position;
            setState(next);
            setRestoreToken((t) => t + 1);
        }
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    // Switching provider/scope/search leaves the remembered position behind:
    // an item id and cursor from the previous feed mean nothing in the new one.
    const setProvider = useCallback((provider: string) => {
        setState((prev) => ({ ...prev, provider, position: {} }));
    }, []);

    const setQuery = useCallback((updater: FeedQuery | ((prev: FeedQuery) => FeedQuery)) => {
        setState((prev) => ({
            ...prev,
            query: typeof updater === 'function' ? (updater as (p: FeedQuery) => FeedQuery)(prev.query) : updater,
            position: {},
        }));
    }, []);

    const setPosition = useCallback((position: FeedPosition) => {
        setState((prev) => (samePosition(prev.position, position) ? prev : { ...prev, position }));
    }, []);

    return {
        provider: state.provider,
        query: state.query,
        /** Position to restore on a cold load / after a back press. Stable
         *  across the scrolling that follows, unlike the live URL. */
        initialPosition: initialPosition.current,
        /** Changes on every back/forward press, so a consumer can key its
         *  restore off it instead of relying on provider/query changing. */
        restoreToken,
        setProvider,
        setQuery,
        setPosition,
    };
}
