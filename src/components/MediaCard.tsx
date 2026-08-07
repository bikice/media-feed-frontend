import { useEffect, useRef } from 'react';
import { Image as ImageIcon, Images, Radio, Video } from 'lucide-react';
import type { MediaItem } from '@/types';
import type { SeekPreview } from '@/hooks/useFeedNavigation';
import { stripTrailingSlash } from '@/lib/slug';
import { HlsPlayer } from './HlsPlayer';
import { VideoProgressBar } from './VideoProgressBar';
import { VideoTapOverlay } from './VideoTapOverlay';
import { VideoSeekIndicator } from './VideoSeekIndicator';

interface MediaCardProps {
    item: MediaItem;
    /** Whether this card is the one currently centered in the viewport. */
    isActive: boolean;
    /** Whether this card should have a live <video>/HLS player mounted at all
     *  (active ± 1, per the performance requirements) vs. just showing a
     *  poster frame. */
    shouldMount: boolean;
    globalMuted: boolean;
    galleryIndex: number;
    onGalleryIndexChange: (index: number) => void;
    /** Re-scope the feed to a given source -- a subreddit or a user slug,
     *  both go through the same `source` filter. Clears any active
     *  search/flair since they belonged to the previous scope. */
    onSelectSource: (sourceSlug: string) => void;
    /** Re-scope the feed to this item's subreddit AND filter it down to this
     *  flair -- flairs are only meaningful within their own subreddit, so
     *  picking one always sets both together. */
    onSelectFlair: (subredditSlug: string, flair: string) => void;
    /** Whether the feed's UI chrome is currently shown. When false, this
     *  card hides its media-type badge and the bottom gradient + metadata
     *  text, for an unobstructed view of the media (toggled via Select/
     *  Enter -- see useFeedNavigation). */
    chromeVisible: boolean;
    /** In-progress MediaFastForward/MediaRewind feedback from
     *  useFeedNavigation, or null when no seek is active. Only meaningful
     *  (and only rendered) while this card `isActive`. */
    seekPreview: SeekPreview | null;
}

type MediaKind = 'image' | 'video' | 'hls';

/** Single source of truth for "what kind of media is this URL/type", shared
 *  by MediaSlot (to decide how to render it) and MediaTypeBadge (to decide
 *  what to label it) so the two can never disagree. */
function resolveMediaKind(type: string, url: string): MediaKind {
    if (type === 'hls' || /\.m3u8(\?|$)/i.test(url)) return 'hls';
    if (type === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video';
    return 'image';
}

const MEDIA_KIND_META: Record<MediaKind, { icon: typeof ImageIcon; label: string }> = {
    image: { icon: ImageIcon, label: 'Photo' },
    video: { icon: Video, label: 'Video' },
    hls: { icon: Radio, label: 'Video' },
};

/** Small pill in the top-left corner naming the media type of whatever is
 *  currently on screen. For a gallery this reflects the *active slide*, so
 *  it updates live as someone swipes from e.g. a photo to a video slide,
 *  rather than describing the gallery's full (possibly mixed) contents. */
function MediaTypeBadge({ kind, isGallery }: { kind: MediaKind; isGallery: boolean }) {
    const { icon: Icon, label } = MEDIA_KIND_META[kind];
    return (
        <div className="glass absolute left-4 safe-top z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-(--color-text-dim)">
            {isGallery && <Images className="h-3.5 w-3.5 text-(--color-purple-soft)" />}
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
        </div>
    );
}

function MediaSlot({
                       type,
                       url,
                       posterUrl,
                       alt,
                       isActive,
                       shouldMount,
                       globalMuted,
                       eager,
                   }: {
    type: string;
    url: string;
    posterUrl: string | null;
    alt: string;
    isActive: boolean;
    shouldMount: boolean;
    globalMuted: boolean;
    eager?: boolean;
}) {
    const kind = resolveMediaKind(type, url);
    const isVideoLike = kind === 'video' || kind === 'hls';
    const isHls = kind === 'hls';
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isActive) {
            video.play().catch(() => {
                // Autoplay was blocked (e.g. no user gesture yet); the tap overlay
                // lets the person start it manually.
            });
        } else {
            video.pause();
        }
    }, [isActive]);

    if (isVideoLike && shouldMount) {
        if (isHls) {
            return <HlsPlayer url={url} posterUrl={posterUrl} active={isActive} muted={globalMuted} />;
        }
        return (
            <div className="relative h-full w-full">
                <video
                    ref={videoRef}
                    src={url}
                    poster={posterUrl ?? undefined}
                    muted={globalMuted}
                    loop
                    autoPlay={isActive}
                    playsInline
                    preload="auto"
                    className="h-full w-full object-contain"
                />
                {isActive && <VideoTapOverlay videoRef={videoRef} />}
                {isActive && <VideoProgressBar videoRef={videoRef} />}
            </div>
        );
    }

    if (isVideoLike && !shouldMount) {
        // Off-window video: show a static poster instead of a live player.
        return (
            <img src={posterUrl ?? url} alt={alt} className="h-full w-full object-contain" loading="lazy" />
        );
    }

    return <img src={url} alt={alt} className="h-full w-full object-contain" loading={eager ? 'eager' : 'lazy'} />;
}

export function MediaCard({
                              item,
                              isActive,
                              shouldMount,
                              globalMuted,
                              galleryIndex,
                              onGalleryIndexChange,
                              onSelectSource,
                              onSelectFlair,
                              chromeVisible,
                              seekPreview,
                          }: MediaCardProps) {
    const gallery = item.gallery && item.gallery.length > 0 ? item.gallery : null;
    const activeSlide = gallery
        ? gallery[Math.min(galleryIndex, gallery.length - 1)]
        : item.mediaUrl
            ? { type: item.type, mediaUrl: item.mediaUrl, posterUrl: item.posterUrl }
            : null;
    const activeKind = activeSlide ? resolveMediaKind(activeSlide.type, activeSlide.mediaUrl) : null;

    return (
        <section className="snap-item relative flex h-dvh w-full items-center justify-center bg-black">
            {gallery ? (
                <div className="absolute inset-0 overflow-hidden">
                    <div
                        className="flex h-full transition-transform duration-300 ease-out"
                        style={{
                            width: `${gallery.length * 100}%`,
                            transform: `translateX(-${(galleryIndex / gallery.length) * 100}%)`,
                        }}
                    >
                        {gallery.map((slide, i) => {
                            const nearActive = Math.abs(i - galleryIndex) <= 1;
                            const slideKind = resolveMediaKind(slide.type, slide.mediaUrl);
                            const isVideoLike = slideKind === 'video' || slideKind === 'hls';
                            return (
                                <div key={i} className="h-full shrink-0" style={{ width: `${100 / gallery.length}%` }}>
                                    {nearActive || !isVideoLike ? (
                                        <MediaSlot
                                            type={slide.type}
                                            url={slide.mediaUrl}
                                            posterUrl={slide.posterUrl ?? null}
                                            alt={item.title ?? ''}
                                            isActive={isActive && i === galleryIndex}
                                            shouldMount={shouldMount && i === galleryIndex}
                                            globalMuted={globalMuted}
                                            eager={!isVideoLike}
                                        />
                                    ) : (
                                        <div className="h-full w-full bg-black" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                activeSlide && (
                    <MediaSlot
                        type={activeSlide.type}
                        url={activeSlide.mediaUrl}
                        posterUrl={activeSlide.posterUrl ?? null}
                        alt={item.title ?? ''}
                        isActive={isActive}
                        shouldMount={shouldMount}
                        globalMuted={globalMuted}
                    />
                )
            )}

            {/* No gallery and no top-level mediaUrl yet: this provider needs a
                per-item lookup to resolve the real media URL (see
                useInfiniteFeed), which is still in flight. Only show the
                spinner for the active card -- off-window neighbors resolve
                silently in the background. */}
            {!gallery && !activeSlide && isActive && (
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-purple) border-t-transparent" />
            )}

            {chromeVisible && activeKind && (
                <MediaTypeBadge kind={activeKind} isGallery={!!gallery && gallery.length > 1} />
            )}

            {isActive && seekPreview && <VideoSeekIndicator seek={seekPreview} />}

            {gallery && (
                <>
                    {galleryIndex > 0 && (
                        <button
                            aria-label="Previous in gallery"
                            onClick={() => onGalleryIndexChange(galleryIndex - 1)}
                            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 hover:text-white md:block"
                        >
                            ‹
                        </button>
                    )}
                    {galleryIndex < gallery.length - 1 && (
                        <button
                            aria-label="Next in gallery"
                            onClick={() => onGalleryIndexChange(galleryIndex + 1)}
                            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 hover:text-white md:block"
                        >
                            ›
                        </button>
                    )}
                </>
            )}

            {chromeVisible && (
                <>
                    {/* Gradient scrim + metadata */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-5">
                        <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2 text-xs text-(--color-text-dim)">
                                {item.subreddit && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectSource(stripTrailingSlash(item.subreddit!.slug));
                                        }}
                                        className="font-medium text-(--color-text) hover:underline"
                                    >
                                        {item.subreddit.name}
                                    </button>
                                )}
                                {item.flairName && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (item.subreddit) {
                                                onSelectFlair(stripTrailingSlash(item.subreddit.slug), item.flairName!);
                                            }
                                        }}
                                        disabled={!item.subreddit}
                                        className="glass rounded-full px-2 py-0.5 text-[10px] transition hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent"
                                    >
                                        {item.flairName}
                                    </button>
                                )}
                            </div>
                            {item.title && (
                                <p className="line-clamp-2 text-sm font-medium text-(--color-text)">{item.title}</p>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectSource(stripTrailingSlash(item.user.slug));
                                }}
                                className="mt-1 text-xs text-(--color-text-dim) hover:text-(--color-text) hover:underline"
                            >
                                {item.user.name}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}