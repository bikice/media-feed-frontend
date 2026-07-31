import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';

interface VideoProgressBarProps {
    /** Ref to the underlying <video> element this bar controls. */
    videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Thin scrub bar pinned to the bottom edge of a video. Shows playback
 * progress as a filled track; hovering reveals a dot at the pointer's
 * position on the timeline; clicking/tapping anywhere on the bar seeks the
 * video there.
 */
export function VideoProgressBar({ videoRef }: VideoProgressBarProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState(0); // 0-1, current playback position
    const [duration, setDuration] = useState(0);
    const [hoverRatio, setHoverRatio] = useState<number | null>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        function onTimeUpdate() {
            if (video && video.duration && Number.isFinite(video.duration)) {
                setProgress(video.currentTime / video.duration);
            }
        }
        function onLoadedMetadata() {
            if (video) setDuration(video.duration);
        }

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        // Metadata may already be available if the element was reused/cached.
        if (video.readyState >= 1) onLoadedMetadata();

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
        };
    }, [videoRef]);

    function ratioFromPointer(e: ReactPointerEvent<HTMLDivElement>): number | null {
        const track = trackRef.current;
        if (!track) return null;
        const rect = track.getBoundingClientRect();
        if (rect.width === 0) return null;
        return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    }

    function handleSeek(e: ReactPointerEvent<HTMLDivElement>) {
        e.stopPropagation();
        const video = videoRef.current;
        const ratio = ratioFromPointer(e);
        if (!video || ratio === null || !duration || !Number.isFinite(duration)) return;
        video.currentTime = ratio * duration;
        setProgress(ratio);
    }

    // Not a seekable video yet (still loading, or a live/indefinite stream).
    if (!duration || !Number.isFinite(duration)) return null;

    return (
        <div
            className="absolute inset-x-0 bottom-0 z-20 flex h-5 cursor-pointer touch-none items-end pb-0"
    onPointerDown={(e) => {
        e.stopPropagation();
        handleSeek(e);
    }}
    onPointerMove={(e) => {
        e.stopPropagation();
        setHoverRatio(ratioFromPointer(e));
    }}
    onPointerLeave={() => setHoverRatio(null)}
>
    <div
        ref={trackRef}
    className={`relative w-full bg-white/20 transition-[height] duration-150 ${
        hoverRatio !== null ? 'h-1.5' : 'h-[3px]'
    }`}
>
    <div
        className="absolute inset-y-0 left-0 bg-(--color-pink)"
    style={{ width: `${progress * 100}%` }}
    />
    {hoverRatio !== null && (
        <div
            className="pointer-events-none absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)]"
        style={{ left: `${hoverRatio * 100}%` }}
        />
    )}
    </div>
    </div>
);
}