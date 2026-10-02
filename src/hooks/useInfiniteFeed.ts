import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeed, getMediaDetail } from '@/lib/api';
import type { FeedQuery, MediaItem } from '@/types';

const WINDOW_RADIUS = 2; // 2 before + active + 2 after = 5 DOM nodes
const PREFETCH_GAP = 2; // fetch next page once fewer than this many items remain

interface UseInfiniteFeedOptions {
  provider: string;
  query: FeedQuery;
  /** Called when the initial load for a scope returns no items while a
   *  non-default `order` is set. Lets the caller drop the ordering and
   *  retry, so a source whose items simply aren't marked for that sort
   *  (e.g. `top`) still shows its content instead of an empty feed. */
  onEmptyWithOrder?: () => void;
  /** `after` cursor to open the feed on, so a restored position doesn't
   *  have to page forward from the start to reach its item. */
  initialCursor?: string;
  /** Id of the item to land on once the first page is in. Verified against
   *  what actually came back -- cursors go stale and listings shift, so a
   *  miss just falls back to the top of the page instead of blocking. */
  initialItemId?: string;
}

interface UseInfiniteFeedResult {
  items: MediaItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Indices that should currently have a mounted DOM node / player. */
  windowIndices: Set<number>;
  isLoading: boolean;
  isLoadingMore: boolean;
  /** A page of *newer* items is being fetched via the `before` cursor,
   *  i.e. the user is scrolling up out of a restored position. */
  isLoadingPrev: boolean;
  error: string | null;
  availableFlairs: string[] | null;
  /** Re-fetch the current feed from scratch (same provider/query), e.g. in
   *  response to a manual reload button or pull-to-refresh gesture. */
  reload: () => void;
  /** Set to the index `initialItemId` was found at, so the caller can scroll
   *  the viewport there (activeIndex alone doesn't move the scroll
   *  container). Null once consumed or when there's nothing to restore. */
  restoreIndex: number | null;
  /** Call after scrolling to `restoreIndex` so it isn't applied twice. */
  consumeRestoreIndex: () => void;
  /** The `after` cursor that was used to fetch the page `index` belongs to
   *  -- i.e. what a later load needs to get straight back to that page.
   *  `undefined` both for the first page (no cursor needed) and for pages
   *  reached by paging backwards, which have no equivalent `after`. */
  cursorForIndex: (index: number) => string | undefined;
  /** Set to the new index of the previously active item right after a
   *  backwards page was prepended, so the caller can re-anchor the scroll
   *  container (prepending shifts every item down by the page size). */
  anchorIndex: number | null;
  /** Call after re-anchoring to `anchorIndex` so it isn't applied twice. */
  consumeAnchorIndex: () => void;
}

export function useInfiniteFeed({
  provider,
  query,
  onEmptyWithOrder,
  initialCursor,
  initialItemId,
}: UseInfiniteFeedOptions): UseInfiniteFeedResult {
  // Keep the latest callback in a ref so the reset/refetch effect below
  // doesn't need it in its dependency array (which would re-run the fetch).
  const onEmptyWithOrderRef = useRef(onEmptyWithOrder);
  useEffect(() => {
    onEmptyWithOrderRef.current = onEmptyWithOrder;
  }, [onEmptyWithOrder]);
  // Same trick for the restore inputs: they're read by the reset effect but
  // deliberately kept out of its deps, since the caller updates the URL
  // (and therefore these) on every swipe -- having them as deps would
  // refetch the whole feed each time the position moved.
  const initialCursorRef = useRef(initialCursor);
  const initialItemIdRef = useRef(initialItemId);
  initialCursorRef.current = initialCursor;
  initialItemIdRef.current = initialItemId;
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFlairs, setAvailableFlairs] = useState<string[] | null>(null);

  const afterCursor = useRef<string | null>(null);
  const hasMore = useRef(true);
  // The mirror image: `pagination.before` pages toward *newer* items. Only
  // ever non-null when the feed didn't open at the top of the listing --
  // i.e. a position was restored from a cursor -- so this is what fills in
  // the items above a restored item instead of leaving a dead end there.
  const beforeCursor = useRef<string | null>(null);
  const hasPrev = useRef(false);
  const [isLoadingPrev, setIsLoadingPrev] = useState(false);
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null);
  const consumeAnchorIndex = useCallback(() => setAnchorIndex(null), []);
  const requestId = useRef(0);
  const [restoreIndex, setRestoreIndex] = useState<number | null>(null);
  const consumeRestoreIndex = useCallback(() => setRestoreIndex(null), []);

  // One entry per loaded page: the index `items` was at when the page was
  // appended, and the `after` cursor that fetched it. Lets cursorForIndex
  // map an item back to the cursor that reaches its page.
  //  `known: false` marks a page that was reached by paging backwards: a
  //  `before` cursor can't be replayed as an `after` one, so there simply is
  //  no cursor that reaches it and the URL has to omit it.
  const pages = useRef<{ startIndex: number; cursor: string | null; known: boolean }[]>([]);

  const cursorForIndex = useCallback((index: number): string | undefined => {
    let found: { cursor: string | null; known: boolean } | null = null;
    for (const page of pages.current) {
      if (page.startIndex > index) break;
      found = page;
    }
    if (!found || !found.known) return undefined;
    return found.cursor ?? undefined;
  }, []);

  // Bumped by `reload()` to force the reset/refetch effect below to run
  // again even when provider/query are unchanged.
  const [reloadToken, setReloadToken] = useState(0);
  // A manual reload / pull-to-refresh means "give me this feed from the
  // top", so the restored position is dropped for that run.
  const skipRestore = useRef(false);
  const reload = useCallback(() => {
    skipRestore.current = true;
    setReloadToken((t) => t + 1);
  }, []);

  // Per-item mediaUrl resolution (see effect below): ids currently in
  // flight, and a ref mirror of `items` so that effect can read the latest
  // list without needing `items` itself in its dependency array.
  const resolvingIds = useRef<Set<string>>(new Set());
  const itemsRef = useRef<MediaItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  // Read by fetchPrevPage, which has to know the index the user is on when
  // its response lands (not when it was fired) to re-anchor the viewport.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Reset and refetch whenever provider or query params change.
  useEffect(() => {
    const myRequestId = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setItems([]);
    setActiveIndex(0);
    const restoreCursor = skipRestore.current ? undefined : initialCursorRef.current;
    const restoreItemId = skipRestore.current ? undefined : initialItemIdRef.current;
    skipRestore.current = false;
    afterCursor.current = null;
    hasMore.current = true;
    beforeCursor.current = null;
    hasPrev.current = false;
    resolvingIds.current.clear();
    pages.current = [{ startIndex: 0, cursor: restoreCursor ?? null, known: true }];
    setRestoreIndex(null);
    setAnchorIndex(null);

    getFeed(provider, { ...query, after: restoreCursor })
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          // A source can return nothing for a given sort (e.g. no entries are
          // marked `top`). Rather than stranding the user on an empty feed,
          // ask the caller to drop the ordering and retry.
          if (res.items.length === 0 && query.order) {
            onEmptyWithOrderRef.current?.();
            return;
          }
          setItems(res.items);
          // Land on the remembered item when it's actually in this page; a
          // stale cursor or a reshuffled listing silently falls back to 0.
          const restoredAt = restoreItemId ? res.items.findIndex((i) => i.id === restoreItemId) : -1;
          if (restoredAt >= 0) {
            setActiveIndex(restoredAt);
            setRestoreIndex(restoredAt);
          }
          afterCursor.current = res.pagination.after;
          hasMore.current = !!res.pagination.after;
          // Opening on a restored cursor means there are items above this
          // page; `before` is how we get them. A feed opened at the top
          // reports `before: null`, so this stays off there.
          beforeCursor.current = res.pagination.before;
          hasPrev.current = !!res.pagination.before;
          setAvailableFlairs(res.availableFlairs);
        })
        .catch(() => {
          if (myRequestId !== requestId.current) return;
          setError('Could not load this feed. Pull to refresh or try a different source.');
        })
        .finally(() => {
          if (myRequestId === requestId.current) setIsLoading(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, query.q, query.source, query.flair, query.order, query.limit, reloadToken]);

  const fetchNextPage = useCallback(() => {
    if (!hasMore.current || isLoadingMore) return;
    const myRequestId = requestId.current;
    const usedCursor = afterCursor.current;
    setIsLoadingMore(true);
    getFeed(provider, { ...query, after: usedCursor ?? undefined })
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = res.items.filter((i) => !seen.has(i.id));
            if (fresh.length > 0 && pages.current[pages.current.length - 1]?.startIndex !== prev.length) {
              pages.current.push({ startIndex: prev.length, cursor: usedCursor, known: true });
            }
            return [...prev, ...fresh];
          });
          afterCursor.current = res.pagination.after;
          hasMore.current = !!res.pagination.after;
        })
        .catch(() => {
          // Silent: the user can keep browsing already-loaded items; the next
          // scroll-triggered attempt will retry.
        })
        .finally(() => {
          if (myRequestId === requestId.current) setIsLoadingMore(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, query, isLoadingMore]);

  // Mirror of fetchNextPage for the other direction: pulls the page of newer
  // items sitting above what's loaded and prepends it, so scrolling up from
  // a position restored mid-listing continues the feed instead of stopping.
  // Every index shifts by the number of prepended items, hence the activeIndex
  // and page-table fixups plus `anchorIndex` for the caller's scroll container.
  const fetchPrevPage = useCallback(() => {
    const usedCursor = beforeCursor.current;
    if (!hasPrev.current || isLoadingPrev || !usedCursor) return;
    const myRequestId = requestId.current;
    setIsLoadingPrev(true);
    getFeed(provider, { ...query, before: usedCursor })
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          const seen = new Set(itemsRef.current.map((p) => p.id));
          const fresh = res.items.filter((i) => !seen.has(i.id));
          if (fresh.length > 0) {
            pages.current = pages.current.map((p) => ({ ...p, startIndex: p.startIndex + fresh.length }));
            pages.current.unshift({ startIndex: 0, cursor: null, known: false });
            setItems((prev) => [...fresh, ...prev]);
            setActiveIndex((idx) => idx + fresh.length);
            setAnchorIndex(activeIndexRef.current + fresh.length);
          }
          beforeCursor.current = res.pagination.before;
          hasPrev.current = !!res.pagination.before;
        })
        .catch(() => {
          // Silent, same as fetchNextPage: a later scroll retries.
        })
        .finally(() => {
          if (myRequestId === requestId.current) setIsLoadingPrev(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, query, isLoadingPrev]);

  // Trigger prefetch once the active item is within PREFETCH_GAP of either
  // end. The upward side is a no-op unless a `before` cursor exists, which
  // only happens for a feed opened mid-listing.
  useEffect(() => {
    if (items.length === 0) return;
    const remaining = items.length - 1 - activeIndex;
    if (remaining < PREFETCH_GAP) fetchNextPage();
    if (activeIndex < PREFETCH_GAP) fetchPrevPage();
  }, [activeIndex, items.length, fetchNextPage, fetchPrevPage]);

  // Resolve mediaUrl for whatever's in the current preload window (active ±
  // WINDOW_RADIUS -- the same window MediaCard/HlsPlayer actually mount)
  // when the listing didn't provide one directly. Requests go out in
  // priority order -- the active item first, then its neighbors by
  // distance -- one at a time, so whatever's actually on screen never waits
  // behind an off-screen neighbor's request.
  useEffect(() => {
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    const indices: number[] = [];
    for (let i = activeIndex - WINDOW_RADIUS; i <= activeIndex + WINDOW_RADIUS; i++) {
      if (i >= 0 && i < currentItems.length) indices.push(i);
    }
    indices.sort((a, b) => Math.abs(a - activeIndex) - Math.abs(b - activeIndex));

    const toResolve = indices
        .map((i) => currentItems[i])
        .filter(
            (item): item is MediaItem =>
                !!item && item.mediaUrl === null && !item.gallery && !resolvingIds.current.has(item.id),
        );

    if (toResolve.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const item of toResolve) {
        if (cancelled) break;
        if (resolvingIds.current.has(item.id)) continue;
        resolvingIds.current.add(item.id);
        try {
          const detail = await getMediaDetail(provider, item.id);
          if (cancelled) continue;
          setItems((prev) => prev.map((it) => (it.id === item.id ? detail : it)));
        } catch {
          // Leave mediaUrl null -- MediaCard already renders a loading state
          // for that case, and clearing the in-flight marker below lets a
          // later window/active-index change retry it.
        } finally {
          resolvingIds.current.delete(item.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, activeIndex, items.length]);

  const windowIndices = new Set<number>();
  for (let i = activeIndex - WINDOW_RADIUS; i <= activeIndex + WINDOW_RADIUS; i++) {
    if (i >= 0 && i < items.length) windowIndices.add(i);
  }

  return {
    items,
    activeIndex,
    setActiveIndex,
    windowIndices,
    isLoading,
    isLoadingMore,
    isLoadingPrev,
    error,
    availableFlairs,
    reload,
    restoreIndex,
    consumeRestoreIndex,
    cursorForIndex,
    anchorIndex,
    consumeAnchorIndex,
  };
}