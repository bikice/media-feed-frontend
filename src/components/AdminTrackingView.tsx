import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, ChevronLeft, ChevronRight, Hash, Sparkles, User, Users, Zap, Clapperboard } from 'lucide-react';
import { getAdminTrackingSearch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAdminTrackingFeed } from '@/hooks/useAdminTrackingFeed';
import type { InstantSearchSource } from '@/types';
import { MediaCard } from './MediaCard';

const SOURCE_TYPE_META: Record<string, { icon: typeof Sparkles; className: string }> = {
    subreddit: { icon: Users, className: 'text-(--color-purple-soft)' },
    user: { icon: User, className: 'text-(--color-pink)' },
    tag: { icon: Hash, className: 'text-(--color-text-dim)' },
    niche: { icon: Sparkles, className: 'text-(--color-purple-soft)' },
    action: { icon: Zap, className: 'text-(--color-pink)' },
    studio: { icon: Clapperboard, className: 'text-(--color-purple-soft)' },
    producer: { icon: Clapperboard, className: 'text-(--color-purple-soft)' },
};
const DEFAULT_SOURCE_META = { icon: Activity, className: 'text-(--color-text-dim)' };

interface AdminTrackingViewProps {
    onBack: () => void;
}

export function AdminTrackingView({ onBack }: AdminTrackingViewProps) {
    const { isAdmin } = useAuth();

    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebouncedValue(searchText, 350);
    const [searchResults, setSearchResults] = useState<InstantSearchSource[]>([]);
    const [selectedSource, setSelectedSource] = useState<InstantSearchSource | null>(null);
    const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
    const [activeIndex, setActiveIndex] = useState(0);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

    useEffect(() => {
        if (!debouncedSearch) {
            setSearchResults([]);
            return;
        }
        let cancelled = false;
        getAdminTrackingSearch(debouncedSearch)
            .then((res) => {
                if (!cancelled) setSearchResults(res.sources);
            })
            .catch(() => {
                if (!cancelled) setSearchResults([]);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedSearch]);

    const { items, isLoading, error, pagination, fetchPage } = useAdminTrackingFeed({
        source: selectedSource?.slug ?? '',
        order,
    });

    // Reset gallery and active index when items change (new page / source).
    useEffect(() => {
        setActiveIndex(0);
        setGalleryIndex(0);
    }, [items]);

    // IntersectionObserver to track active item.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                        const idx = Number((entry.target as HTMLElement).dataset.index);
                        if (!Number.isNaN(idx)) setActiveIndex(idx);
                    }
                }
            },
            { root: container, threshold: [0.6] },
        );
        sectionRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [items.length]);

    if (!isAdmin) {
        return (
            <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-black text-(--color-text)">
                <p className="text-sm text-(--color-text-dim)">Access denied.</p>
                <button onClick={onBack} className="text-sm text-(--color-pink) underline">Go back</button>
            </div>
        );
    }

    return (
        <div className="relative flex h-dvh w-full flex-col bg-black text-(--color-text)">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border) px-4 py-3 safe-top">
                <button
                    onClick={onBack}
                    aria-label="Back"
                    className="flex items-center gap-1.5 text-sm text-(--color-text-dim) transition hover:text-(--color-text)"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                <div className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-(--color-pink)" />
                    <span className="text-sm font-medium">View Tracking</span>
                </div>
            </div>

            {/* Controls */}
            <div className="shrink-0 border-b border-(--color-border) px-4 py-3 space-y-3">
                {/* User search */}
                <div className="relative">
                    {selectedSource ? (
                        <div className="flex items-center gap-2 rounded-lg border border-(--color-pink) bg-(--color-surface-2) px-3 py-2.5">
                            {(() => {
                                const meta = SOURCE_TYPE_META[selectedSource.type] ?? DEFAULT_SOURCE_META;
                                const Icon = meta.icon;
                                return <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} />;
                            })()}
                            <span className="flex-1 truncate text-sm">{selectedSource.name}</span>
                            <button
                                onClick={() => { setSelectedSource(null); setSearchText(''); }}
                                className="text-xs text-(--color-text-dim) hover:text-(--color-text)"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Search user by email…"
                                className="w-full rounded-lg border border-(--color-border) bg-(--color-surface-2) px-3 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-dim) outline-none focus:border-(--color-purple)"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-(--color-border) bg-(--color-surface-2) shadow-lg overflow-hidden">
                                    {searchResults.map((src) => {
                                        const meta = SOURCE_TYPE_META[src.type] ?? DEFAULT_SOURCE_META;
                                        const Icon = meta.icon;
                                        return (
                                            <button
                                                key={src.slug}
                                                onClick={() => { setSelectedSource(src); setSearchText(''); setSearchResults([]); }}
                                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-white/5"
                                            >
                                                <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} />
                                                <span className="truncate">{src.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Order toggle */}
                <div className="flex gap-2">
                    {(['newest', 'oldest'] as const).map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setOrder(opt)}
                            className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                                order === opt
                                    ? 'border-(--color-pink) text-(--color-text)'
                                    : 'border-(--color-border) text-(--color-text-dim) hover:text-(--color-text)'
                            }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>

            {/* Feed */}
            {!selectedSource ? (
                <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-(--color-text-dim)">Search for a user to view their history.</p>
                </div>
            ) : isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-purple) border-t-transparent" />
                </div>
            ) : error ? (
                <div className="flex flex-1 items-center justify-center px-8 text-center">
                    <p className="text-sm text-(--color-text-dim)">{error}</p>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-8 text-center">
                    <p className="text-sm text-(--color-text-dim)">No tracked views found for this user.</p>
                </div>
            ) : (
                <>
                    <div
                        ref={containerRef}
                        className="snap-feed flex-1 overflow-y-scroll outline-none"
                        tabIndex={-1}
                    >
                        {items.map((item, index) => (
                            <div
                                key={`${item.id}-${index}`}
                                ref={(el) => {
                                    if (el) sectionRefs.current.set(index, el);
                                    else sectionRefs.current.delete(index);
                                }}
                                data-index={index}
                                className="snap-item h-dvh w-full"
                            >
                                <MediaCard
                                    item={item}
                                    isActive={index === activeIndex}
                                    shouldMount={Math.abs(index - activeIndex) <= 1}
                                    globalMuted={true}
                                    galleryIndex={index === activeIndex ? galleryIndex : 0}
                                    onGalleryIndexChange={setGalleryIndex}
                                    onSelectSource={() => {}}
                                    onSelectFlair={() => {}}
                                    chromeVisible={true}
                                    seekPreview={null}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="shrink-0 flex items-center justify-between border-t border-(--color-border) px-4 py-3 safe-bottom">
                        <button
                            disabled={!pagination.before}
                            onClick={() => pagination.before && fetchPage({ before: pagination.before })}
                            className="flex items-center gap-1 rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-dim) transition hover:text-(--color-text) disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Newer
                        </button>
                        <button
                            disabled={!pagination.after}
                            onClick={() => pagination.after && fetchPage({ after: pagination.after })}
                            className="flex items-center gap-1 rounded-lg border border-(--color-border) px-3 py-2 text-sm text-(--color-text-dim) transition hover:text-(--color-text) disabled:opacity-30"
                        >
                            Older
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
