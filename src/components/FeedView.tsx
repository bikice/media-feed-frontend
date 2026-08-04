import { useCallback, useEffect, useRef, useState } from 'react';
import { getProviders } from '@/lib/api';
import { loadFeedPreferences, saveFeedPreferences } from '@/lib/feedPreferences';
import { useInfiniteFeed } from '@/hooks/useInfiniteFeed';
import { useFeedNavigation } from '@/hooks/useFeedNavigation';
import type { FeedQuery, ProviderInfo } from '@/types';
import { GalleryDots } from './GalleryDots';
import { LocationBadge } from './LocationBadge';
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
    const [sidebarOpen, setSidebarOpen] = useState(initialPrefs?.sidebarOpen ?? false);
    const [chromeVisible, setChromeVisible] = useState(true);
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
        saveFeedPreferences({ provider, query, sidebarOpen });
    }, [provider, query, sidebarOpen]);

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

    // Fire TV / D-pad support: opening the sidebar hands focus to it (see
    // useSpatialNavigation), and closing it -- whether via the left-edge
    // D-pad press, the X button, or tapping the backdrop -- hands focus
    // back to the feed so ArrowUp/Down keep driving it immediately.
    const openSidebar = useCallback(() => setSidebarOpen(true), []);
    const closeSidebar = useCallback(() => {
        setSidebarOpen(false);
        requestAnimationFrame(() => containerRef.current?.focus());
    }, []);

    // Select/Enter toggles the feed's UI chrome (OverlayNav, media-type
    // badge, bottom gradient + metadata) for an unobstructed view of the
    // media -- only while the sidebar is closed (see useFeedNavigation).
    const toggleChrome = useCallback(() => setChromeVisible((v) => !v), []);

    const activeItem = items[activeIndex];
    const activeGallery = activeItem?.gallery;
    const isGalleryActive = !!activeGallery && activeGallery.length > 1;
    const activeProviderLabel = providers.find((p) => p.slug === provider)?.title ?? provider;

    const { seekPreview } = useFeedNavigation({
        containerRef,
        itemCount: items.length,
        activeIndex,
        scrollToIndex,
        isGalleryActive,
        galleryIndex,
        galleryLength: activeGallery?.length ?? 0,
        onGalleryChange: setGalleryIndex,
        sidebarOpen,
        onOpenSidebar: openSidebar,
        onToggleChrome: toggleChrome,
    });

    // Re-scope the feed to a source (subreddit or user) tapped from a card's
    // metadata. Clears any active search text or flair, since both belonged
    // to the previous scope and may not make sense (or match anything) in
    // the new one.
    const handleSelectSource = useCallback((sourceSlug: string) => {
        setQuery((prev) => ({ ...prev, source: sourceSlug, flair: undefined, q: undefined }));
    }, []);

    // Flairs only make sense within their own subreddit, so picking one from
    // a card always sets `source` and `flair` together.
    const handleSelectFlair = useCallback((subredditSlug: string, flair: string) => {
        setQuery((prev) => ({ ...prev, source: subredditSlug, flair, q: undefined }));
    }, []);

    return (
        <div className="relative h-dvh w-full overflow-hidden bg-black">
            <div ref={containerRef} tabIndex={-1} className="snap-feed h-full w-full overflow-y-scroll outline-none">
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
                                    onSelectSource={handleSelectSource}
                                    onSelectFlair={handleSelectFlair}
                                    chromeVisible={chromeVisible}
                                    seekPreview={seekPreview}
                                />
                            ) : (
                                <div className="h-full w-full bg-black" />
                            )}
                        </div>
                    );
                })}
            </div>

            {chromeVisible && (
                <div className="pointer-events-none fixed inset-x-0 top-4 z-20 flex flex-col items-center gap-2">
                    <LocationBadge providerLabel={activeProviderLabel} sourceLabel={query.source ?? null} />
                    {isGalleryActive && <GalleryDots count={activeGallery!.length} index={galleryIndex} />}
                </div>
            )}

            {chromeVisible && (
                <OverlayNav onToggleSidebar={() => (sidebarOpen ? closeSidebar() : openSidebar())} />
            )}

            <Sidebar
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                providers={providers}
                provider={provider}
                onProviderChange={(slug) => {
                    setProvider(slug);
                    // Keep the active search text (it's not provider-specific),
                    // but source/flair/order belonged to the old provider's
                    // scope and sort options, so drop them.
                    setQuery((prev) => ({ q: prev.q }));
                }}
                query={query}
                onQueryChange={setQuery}
                availableFlairs={availableFlairs}
                muted={muted}
                onToggleMute={() => setMuted((v) => !v)}
            />
        </div>
    );
}