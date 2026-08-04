import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeed, getMediaDetail } from '@/lib/api';
import type { FeedQuery, MediaItem } from '@/types';

const WINDOW_RADIUS = 2; // 2 before + active + 2 after = 5 DOM nodes
const PREFETCH_GAP = 2; // fetch next page once fewer than this many items remain

interface UseInfiniteFeedOptions {
  provider: string;
  query: FeedQuery;
}

interface UseInfiniteFeedResult {
  items: MediaItem[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  /** Indices that should currently have a mounted DOM node / player. */
  windowIndices: Set<number>;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  availableFlairs: string[] | null;
}

export function useInfiniteFeed({ provider, query }: UseInfiniteFeedOptions): UseInfiniteFeedResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableFlairs, setAvailableFlairs] = useState<string[] | null>(null);

  const afterCursor = useRef<string | null>(null);
  const hasMore = useRef(true);
  const requestId = useRef(0);

  // Per-item mediaUrl resolution (see effect below): ids currently in
  // flight, and a ref mirror of `items` so that effect can read the latest
  // list without needing `items` itself in its dependency array.
  const resolvingIds = useRef<Set<string>>(new Set());
  const itemsRef = useRef<MediaItem[]>(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Reset and refetch whenever provider or query params change.
  useEffect(() => {
    const myRequestId = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setItems([]);
    setActiveIndex(0);
    afterCursor.current = null;
    hasMore.current = true;
    resolvingIds.current.clear();

    getFeed(provider, query)
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          setItems(res.items);
          afterCursor.current = res.pagination.after;
          hasMore.current = !!res.pagination.after;
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
  }, [provider, query.q, query.source, query.flair, query.order, query.limit]);

  const fetchNextPage = useCallback(() => {
    if (!hasMore.current || isLoadingMore) return;
    const myRequestId = requestId.current;
    setIsLoadingMore(true);
    getFeed(provider, { ...query, after: afterCursor.current ?? undefined })
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          setItems((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            const fresh = res.items.filter((i) => !seen.has(i.id));
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

  // Trigger prefetch once the active item is within PREFETCH_GAP of the end.
  useEffect(() => {
    if (items.length === 0) return;
    const remaining = items.length - 1 - activeIndex;
    if (remaining < PREFETCH_GAP) fetchNextPage();
  }, [activeIndex, items.length, fetchNextPage]);

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
    error,
    availableFlairs,
  };
}