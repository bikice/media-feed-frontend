import { useCallback, useEffect, useRef, useState } from 'react';
import { getProviders } from '@/lib/api';
import { loadFeedPreferences, saveFeedPreferences } from '@/lib/feedPreferences';
import { useInfiniteFeed } from '@/hooks/useInfiniteFeed';
import { useFeedNavigation } from '@/hooks/useFeedNavigation';
import type { FeedQuery, ProviderInfo } from '@/types';
import { MediaCard } from './MediaCard';
import { OverlayNav } from './OverlayNav';
import { Sidebar } from './Sidebar';

// Read once at module init time so the very first render already reflects
// whatever was saved on a previous visit (avoids a flash of the defaults).
const initialPrefs = loadFeedPreferences();

export function FeedView() {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [provider, setProvider] = useState(initialPrefs?.provider ?? 'reddit');
    const [query, setQuery] = useState<FeedQuery>(initialPrefs?.query ?? {});
    const [muted, setMuted] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

    useEffect(() => {
        getProviders()
            .then((list) => {
                setProviders(list);
                if (list.length > 0 && !list.some((p) => p.slug === provider)) {
                    setProvider(list[0].slug);
                }
            })
            .catch(() => {
                // Fall back to the "reddit" default already in state; the feed
                // request itself will surface an error if that slug is invalid too.
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        saveFeedPreferences({ provider, query });
    }, [provider, query]);

    const { items, activeIndex, setActiveIndex, windowIndices, isLoading, error, availableFlairs } =
        useInfiniteFeed({ provider, query });

    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

    const scrollToIndex = useCallback((index: number) => {
        sectionRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // Reset gallery position whenever the active card changes.
    useEffect(() => {
        setGalleryIndex(0);
    }, [activeIndex]);

    // Track which item is centered in the viewport.
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
    }, [items.length, setActiveIndex]);

    const activeItem = items[activeIndex];
    const activeGallery = activeItem?.gallery;
    const isGalleryActive = !!activeGallery && activeGallery.length > 1;

    useFeedNavigation({
        containerRef,
        itemCount: items.length,
        activeIndex,
        scrollToIndex,
        isGalleryActive,
        galleryIndex,
        galleryLength: activeGallery?.length ?? 0,
        onGalleryChange: setGalleryIndex,
    });

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-black">
            <div ref={containerRef} className="snap-feed h-full w-full overflow-y-scroll">
                {isLoading && items.length === 0 && (
                    <div className="flex h-dvh w-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-purple) border-t-transparent" />
                    </div>
                )}

                {!isLoading && error && items.length === 0 && (
                    <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 px-8 text-center">
                        <p className="text-sm text-(--color-text-dim)">{error}</p>
                    </div>
                )}

                {!isLoading && !error && items.length === 0 && (
                    <div className="flex h-dvh w-full flex-col items-center justify-center gap-2 px-8 text-center">
                        <p className="text-sm text-(--color-text-dim)">
                            Nothing here yet. Try a different provider or search.
                        </p>
                    </div>
                )}

                {items.map((item, index) => {
                    const isWindowed = windowIndices.has(index);
                    return (
                        <div
                            key={item.id}
                            ref={(el) => {
                                if (el) sectionRefs.current.set(index, el);
                                else sectionRefs.current.delete(index);
                            }}
                            data-index={index}
                            className="snap-item h-dvh w-full"
                        >
                            {isWindowed ? (
                                <MediaCard
                                    item={item}
                                    isActive={index === activeIndex}
                                    shouldMount={Math.abs(index - activeIndex) <= 1}
                                    globalMuted={muted}
                                    galleryIndex={index === activeIndex ? galleryIndex : 0}
                                    onGalleryIndexChange={setGalleryIndex}
                                />
                            ) : (
                                <div className="h-full w-full bg-black" />
                            )}
                        </div>
                    );
                })}
            </div>

            <OverlayNav
                muted={muted}
                onToggleMute={() => setMuted((v) => !v)}
                onToggleSidebar={() => setSidebarOpen((v) => !v)}
            />

            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                providers={providers}
                provider={provider}
                onProviderChange={(slug) => {
                    setProvider(slug);
                    setQuery({});
                }}
                query={query}
                onQueryChange={setQuery}
                availableFlairs={availableFlairs}
            />
        </div>
    );
}