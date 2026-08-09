import { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminTrackingFeed } from '@/lib/api';
import type { FeedPagination, MediaItem } from '@/types';

interface UseAdminTrackingFeedOptions {
  source: string;
  order?: string;
}

interface UseAdminTrackingFeedResult {
  items: MediaItem[];
  isLoading: boolean;
  error: string | null;
  pagination: FeedPagination;
  fetchPage: (cursor: { before: string } | { after: string }) => void;
}

export function useAdminTrackingFeed({ source, order }: UseAdminTrackingFeedOptions): UseAdminTrackingFeedResult {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<FeedPagination>({ before: null, after: null });
  const requestId = useRef(0);

  const load = useCallback(
    (opts?: { before?: string; after?: string }) => {
      if (!source) return;
      const myRequestId = ++requestId.current;
      setIsLoading(true);
      setError(null);
      getAdminTrackingFeed(source, { order, ...opts })
        .then((res) => {
          if (myRequestId !== requestId.current) return;
          setItems(res.items);
          setPagination(res.pagination);
        })
        .catch(() => {
          if (myRequestId !== requestId.current) return;
          setError('Could not load tracking feed.');
        })
        .finally(() => {
          if (myRequestId === requestId.current) setIsLoading(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, order],
  );

  // Reset and reload when source or order changes.
  useEffect(() => {
    setItems([]);
    setPagination({ before: null, after: null });
    load();
  }, [load]);

  const fetchPage = useCallback(
    (cursor: { before: string } | { after: string }) => {
      load(cursor);
    },
    [load],
  );

  return { items, isLoading, error, pagination, fetchPage };
}
