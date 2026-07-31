import { useState } from 'react';
import { Heart, MessageCircle, Volume2, VolumeX } from 'lucide-react';
import type { MediaItem } from '@/types';
import { HlsPlayer } from './HlsPlayer';

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
  const isVideoLike = type === 'video' || type === 'hls' || /\.(mp4|webm|m3u8)(\?|$)/i.test(url);
  const isHls = type === 'hls' || /\.m3u8(\?|$)/i.test(url);

  if (isVideoLike && shouldMount) {
    if (isHls) {
      return <HlsPlayer url={url} posterUrl={posterUrl} active={isActive} muted={globalMuted} />;
    }
    return (
      <video
        src={url}
        poster={posterUrl ?? undefined}
        muted={globalMuted}
        loop
        autoPlay={isActive}
        playsInline
        className="h-full w-full object-contain"
      />
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

  return (
    <section className="snap-item relative flex h-dvh w-full items-center justify-center bg-black">
      {activeSlide && (
        <MediaSlot
          type={activeSlide.type}
          url={activeSlide.mediaUrl}
          posterUrl={activeSlide.posterUrl ?? null}
          alt={item.title ?? ''}
          isActive={isActive}
          shouldMount={shouldMount}
          globalMuted={globalMuted}
        />
      )}

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
