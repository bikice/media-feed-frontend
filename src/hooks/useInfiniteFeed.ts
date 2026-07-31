import { useCallback, useEffect, useRef, useState } from 'react';
import { getFeed } from '@/lib/api';
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

  // Reset and refetch whenever provider or query params change.
  useEffect(() => {
    const myRequestId = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setItems([]);
    setActiveIndex(0);
    afterCursor.current = null;
    hasMore.current = true;

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
