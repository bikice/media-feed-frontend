import { useCallback, useEffect, useRef, useState } from 'react';
import { getProviders, trackView } from '@/lib/api';
import { loadFeedPreferences, saveFeedPreferences } from '@/lib/feedPreferences';
import { useFeedUrlState } from '@/hooks/useFeedUrlState';
import { useInfiniteFeed } from '@/hooks/useInfiniteFeed';
import { useFeedNavigation } from '@/hooks/useFeedNavigation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { RefreshCw } from 'lucide-react';
import type { ProviderInfo } from '@/types';
import { GalleryDots } from './GalleryDots';
import { LocationBadge } from './LocationBadge';
import { MediaCard } from './MediaCard';
import { OverlayNav } from './OverlayNav';
import { Sidebar } from './Sidebar';

// Read once at module init time purely for `sidebarOpen` -- provider/query
// now come from useFeedUrlState, which does its own (URL-aware) read of
// the same storage. Kept separate so the very first render already
// reflects whatever sidebar state was saved, without waiting on an effect.
const initialPrefs = loadFeedPreferences();

// How long the feed's UI chrome stays visible after a new item is shown
// before it auto-hides for an unobstructed view of the media.
const CHROME_HIDE_DELAY_MS = 2500;

interface FeedViewProps {
    onOpenAdminTracking?: () => void;
}

export function FeedView({ onOpenAdminTracking }: FeedViewProps = {}) {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const { provider, query, setProvider, setQuery } = useFeedUrlState();
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

    const { items, activeIndex, setActiveIndex, windowIndices, isLoading, error, availableFlairs, reload } =
        useInfiniteFeed({ provider, query });

    const containerRef = useRef<HTMLDivElement>(null);

    // Manual reload button + pull-to-refresh both re-fetch the current feed.
    // Reveal the chrome on a reload so the spinning button is visible as
    // feedback, and (harmlessly) scroll back to the top for the fresh list.
    const handleReload = useCallback(() => {
        reload();
        containerRef.current?.scrollTo({ top: 0 });
    }, [reload]);

    const { pullDistance, armed } = usePullToRefresh({
        containerRef,
        onRefresh: handleReload,
        disabled: sidebarOpen,
    });
    const sectionRefs = useRef<Map<number, HTMLElement>>(new Map());

    const scrollToIndex = useCallback((index: number) => {
        sectionRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // Reset gallery position whenever the active card changes.
    useEffect(() => {
        setGalleryIndex(0);
    }, [activeIndex]);

    // Fire-and-forget view tracking once per unique (item, gallery slide).
    const lastTracked = useRef<{ index: number; galleryIndex: number }>({ index: -1, galleryIndex: -1 });

    // Reset tracking ref when the feed scope changes so the first item of
    // the new feed is always tracked.
    useEffect(() => {
        lastTracked.current = { index: -1, galleryIndex: -1 };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [provider, query.source, query.flair, query.order, query.q]);

    useEffect(() => {
        if (
            lastTracked.current.index === activeIndex &&
            lastTracked.current.galleryIndex === galleryIndex
        ) return;
        const item = items[activeIndex];
        if (!item) return;
        lastTracked.current = { index: activeIndex, galleryIndex };
        trackView(item.provider, item.id, query, galleryIndex).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, galleryIndex, items, query.q, query.source, query.flair, query.order]);

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

    // Android hardware back: dismiss the sidebar first if it's open, then
    // fall through to stepping back through the feed's selection history
    // (provider/source/flair/order/search) that useFeedUrlState maintains --
    // and only exit the app once there's nothing left to unwind.
    const handleAndroidBack = useCallback(() => {
        if (sidebarOpen) {
            closeSidebar();
            return true;
        }
        return false;
    }, [sidebarOpen, closeSidebar]);
    useAndroidBackButton(handleAndroidBack);

    // Select/Enter toggles the feed's UI chrome (OverlayNav, media-type
    // badge, bottom gradient + metadata) for an unobstructed view of the
    // media -- only while the sidebar is closed (see useFeedNavigation).
    const toggleChrome = useCallback(() => setChromeVisible((v) => !v), []);

    // Reveal the chrome and (re)start the auto-hide countdown. Called both
    // when a new item/slide comes into view and whenever the user taps, so a
    // tap always brings the chrome back and refreshes the timer.
    const chromeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const revealChrome = useCallback(() => {
        setChromeVisible(true);
        if (chromeHideTimer.current) clearTimeout(chromeHideTimer.current);
        chromeHideTimer.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_DELAY_MS);
    }, []);

    // Auto-hide the chrome a short moment after a new item (or gallery slide)
    // comes into view, so the media is shown unobstructed. Each time the
    // active item changes we reveal the chrome again and restart the timer.
    useEffect(() => {
        revealChrome();
        return () => {
            if (chromeHideTimer.current) clearTimeout(chromeHideTimer.current);
        };
    }, [activeIndex, galleryIndex, revealChrome]);

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
            <div ref={containerRef} tabIndex={-1} onPointerDown={revealChrome} className="snap-feed h-full w-full overflow-y-scroll outline-none">
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
                <div className="pointer-events-none fixed inset-x-0 safe-top z-20 flex flex-col items-center gap-2">
                    <LocationBadge providerLabel={activeProviderLabel} sourceLabel={query.source ?? null} />
                    {isGalleryActive && <GalleryDots count={activeGallery!.length} index={galleryIndex} />}
                </div>
            )}

            {(pullDistance > 0 || (isLoading && items.length > 0)) && (
                <div
                    className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center safe-top"
                    style={{ transform: `translateY(${isLoading ? 16 : Math.max(0, pullDistance - 24)}px)` }}
                >
                    <div className="glass rounded-full p-2.5 text-(--color-text)">
                        <RefreshCw
                            className={`h-5 w-5${isLoading || armed ? ' animate-spin' : ''}`}
                            style={isLoading ? undefined : { transform: `rotate(${pullDistance * 3}deg)` }}
                        />
                    </div>
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
                onOpenAdminTracking={onOpenAdminTracking}
            />
        </div>
    );
}