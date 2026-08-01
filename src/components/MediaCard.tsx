import { useEffect, useRef, useState } from 'react';
import { Heart, Image as ImageIcon, Images, MessageCircle, Radio, Video, Volume2, VolumeX } from 'lucide-react';
import type { MediaItem } from '@/types';
import { HlsPlayer } from './HlsPlayer';
import { VideoProgressBar } from './VideoProgressBar';
import { VideoTapOverlay } from './VideoTapOverlay';

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
}

function formatVotes(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
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
        <div className="glass absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-(--color-text-dim)">
            {isGallery && <Images className="h-3.5 w-3.5 text-(--color-purple-soft)" />}
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
        </div>
    );
}

function GalleryDots({ count, index }: { count: number; index: number }) {
    if (count <= 1) return null;
    return (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2">
            <div className="glass rounded-full px-2.5 py-1 font-(family-name:--font-mono) text-[11px] text-(--color-text-dim)">
                {index + 1} / {count}
            </div>
            <div className="flex gap-1">
                {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                    <span
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                            i === index ? 'bg-(--color-pink)' : 'bg-white/25'
                        }`}
                    />
                ))}
            </div>
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
                   }: {
    type: string;
    url: string;
    posterUrl: string | null;
    alt: string;
    isActive: boolean;
    shouldMount: boolean;
    globalMuted: boolean;
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

    return <img src={url} alt={alt} className="h-full w-full object-contain" loading="lazy" />;
}

export function MediaCard({
                              item,
                              isActive,
                              shouldMount,
                              globalMuted,
                              galleryIndex,
                              onGalleryIndexChange,
                          }: MediaCardProps) {
    const [liked, setLiked] = useState(false);
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
                            return (
                                <div key={i} className="h-full shrink-0" style={{ width: `${100 / gallery.length}%` }}>
                                    {nearActive ? (
                                        <MediaSlot
                                            type={slide.type}
                                            url={slide.mediaUrl}
                                            posterUrl={slide.posterUrl ?? null}
                                            alt={item.title ?? ''}
                                            isActive={isActive && i === galleryIndex}
                                            shouldMount={shouldMount && i === galleryIndex}
                                            globalMuted={globalMuted}
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

            {activeKind && <MediaTypeBadge kind={activeKind} isGallery={!!gallery && gallery.length > 1} />}

            {gallery && (
                <>
                    <GalleryDots count={gallery.length} index={galleryIndex} />
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

            {/* Gradient scrim + metadata */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-5">
                <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2 text-xs text-(--color-text-dim)">
                        {item.subreddit && (
                            <span className="font-medium text-(--color-text)">{item.subreddit.name}</span>
                        )}
                        {item.flairName && (
                            <span className="glass rounded-full px-2 py-0.5 text-[10px]">{item.flairName}</span>
                        )}
                    </div>
                    {item.title && (
                        <p className="line-clamp-2 text-sm font-medium text-(--color-text)">{item.title}</p>
                    )}
                    <p className="mt-1 text-xs text-(--color-text-dim)">{item.user.name}</p>
                </div>

                <div className="flex shrink-0 flex-col items-center gap-4">
                    <button
                        onClick={() => setLiked((v) => !v)}
                        className="flex flex-col items-center gap-1"
                        aria-pressed={liked}
                        aria-label="Like"
                    >
                        <Heart
                            className={`h-6 w-6 transition-colors ${liked ? 'fill-(--color-pink) text-(--color-pink)' : 'text-white'}`}
                        />
                        <span className="text-[11px] text-(--color-text-dim)">{formatVotes(item.votes)}</span>
                    </button>
                    {item.permalink && (
                        <a
                            href={item.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex flex-col items-center gap-1 text-white"
                            aria-label="Open discussion"
                        >
                            <MessageCircle className="h-6 w-6" />
                        </a>
                    )}
                    {globalMuted ? (
                        <VolumeX className="h-5 w-5 text-(--color-text-dim)" />
                    ) : (
                        <Volume2 className="h-5 w-5 text-(--color-text-dim)" />
                    )}
                </div>
            </div>
        </section>
    );
}