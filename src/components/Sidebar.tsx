import { useEffect, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import type { FeedQuery, InstantSearchResponse, ProviderInfo } from '@/types';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getInstantSearch } from '@/lib/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  providers: ProviderInfo[];
  provider: string;
  onProviderChange: (slug: string) => void;
  query: FeedQuery;
  onQueryChange: (next: FeedQuery) => void;
  availableFlairs: string[] | null;
}

export function Sidebar({
                          isOpen,
                          onClose,
                          providers,
                          provider,
                          onProviderChange,
                          query,
                          onQueryChange,
                          availableFlairs,
                        }: SidebarProps) {
  const [searchText, setSearchText] = useState(query.q ?? '');
  const debouncedSearch = useDebouncedValue(searchText, 350);
  const [suggestions, setSuggestions] = useState<InstantSearchResponse | null>(null);

  const activeProviderInfo = providers.find((p) => p.slug === provider);
  const orderParam = activeProviderInfo?.feedParams.find((p) => p.name === 'order');

  useEffect(() => {
    onQueryChange({ ...query, q: debouncedSearch || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (!debouncedSearch) {
      setSuggestions(null);
      return;
    }
    let cancelled = false;
    getInstantSearch(provider, debouncedSearch)
        .then((res) => {
          if (!cancelled) setSuggestions(res);
        })
        .catch(() => {
          if (!cancelled) setSuggestions(null);
        });
    return () => {
      cancelled = true;
    };
  }, [provider, debouncedSearch]);

  return (
      <>
        {isOpen && (
            <div
                className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
                onClick={onClose}
                aria-hidden
            />
        )}
        <aside
            className={`glass fixed right-0 top-0 z-40 h-dvh w-[85vw] max-w-sm border-l border-(--color-border) p-5 transition-transform duration-300 ${
                isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-(family-name:--font-display) text-lg font-semibold">Discover</h2>
            <button
                onClick={onClose}
                className="rounded-full p-1.5 text-(--color-text-dim) hover:bg-white/5 hover:text-(--color-text)"
                aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Provider selector */}
          <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Provider</label>
          <div className="mb-5 flex flex-wrap gap-2">
            {providers.map((p) => (
                <button
                    key={p.slug}
                    onClick={() => onProviderChange(p.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        p.slug === provider
                            ? 'border-transparent bg-gradient-to-r from-(--color-purple) to-(--color-pink) text-white'
                            : 'border-(--color-border) bg-(--color-surface-2) text-(--color-text-dim) hover:text-(--color-text)'
                    }`}
                >
                  {p.title}
                </button>
            ))}
          </div>

          {/* Search */}
          <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)" htmlFor="sidebar-search">
            Search
          </label>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-dim)" />
            <input
                id="sidebar-search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search this provider…"
                className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-2) py-2.5 pl-9 pr-3 text-sm outline-none focus:border-(--color-pink)"
            />
          </div>

          {suggestions && (suggestions.subreddits.length > 0 || suggestions.users.length > 0) && (
              <div className="mb-5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-(--color-border) bg-(--color-surface-2) p-2">
                {suggestions.subreddits.map((s) => (
                    <button
                        key={s.slug}
                        onClick={() => {
                          onQueryChange({ ...query, source: s.slug, q: undefined, flair: undefined });
                          setSearchText('');
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-(--color-purple-soft)" />
                      <span className="truncate">{s.name}</span>
                    </button>
                ))}
                {suggestions.users.map((u) => (
                    <button
                        key={u.slug}
                        onClick={() => {
                          onQueryChange({ ...query, source: u.slug, q: undefined, flair: undefined });
                          setSearchText('');
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-(--color-pink)" />
                      <span className="truncate">{u.name}</span>
                    </button>
                ))}
              </div>
          )}

          {query.source && (
              <div className="mb-5 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2 text-sm">
            <span className="truncate text-(--color-text-dim)">
              Source: <span className="text-(--color-text)">{query.source}</span>
            </span>
                <button
                    onClick={() => onQueryChange({ ...query, source: undefined, flair: undefined })}
                    className="text-(--color-text-dim) hover:text-(--color-text)"
                    aria-label="Clear source"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
          )}

          {/* Order */}
          {orderParam?.enum && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Sort</label>
                <div className="mb-5 flex flex-wrap gap-2">
                  {orderParam.enum.map((opt) => (
                      <button
                          key={opt}
                          onClick={() => onQueryChange({ ...query, order: opt })}
                          className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                              (query.order ?? orderParam.default) === opt
                                  ? 'border-(--color-pink) text-(--color-text)'
                                  : 'border-(--color-border) text-(--color-text-dim) hover:text-(--color-text)'
                          }`}
                      >
                        {opt}
                      </button>
                  ))}
                </div>
              </>
          )}

          {/* Dynamic flair filter, populated from the current feed response */}
          {availableFlairs && availableFlairs.length > 0 && (
              <>
                <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)">Flair</label>
                <div className="flex flex-wrap gap-2">
                  <button
                      onClick={() => onQueryChange({ ...query, flair: undefined })}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                          !query.flair
                              ? 'border-(--color-pink) text-(--color-text)'
                              : 'border-(--color-border) text-(--color-text-dim) hover:text-(--color-text)'
                      }`}
                  >
                    All
                  </button>
                  {availableFlairs.map((f) => (
                      <button
                          key={f}
                          onClick={() => onQueryChange({ ...query, flair: f })}
                          className={`rounded-full border px-3 py-1 text-xs transition ${
                              query.flair === f
                                  ? 'border-(--color-pink) text-(--color-text)'
                                  : 'border-(--color-border) text-(--color-text-dim) hover:text-(--color-text)'
                          }`}
                      >
                        {f}
                      </button>
                  ))}
                </div>
              </>
          )}
        </aside>
      </>
  );
}