import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { Play } from 'lucide-react';

interface VideoTapOverlayProps {
    /** Ref to the underlying <video> element this overlay controls. */
    videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Transparent full-size layer over a <video>. Tapping/clicking anywhere on
 * it toggles play/pause. Sits below the progress bar and gallery controls
 * (both stop propagation / paint above it), so it never steals those taps.
 */
export function VideoTapOverlay({ videoRef }: VideoTapOverlayProps) {
    const [paused, setPaused] = useState(false);

    // Track the video's real play state via its native events, rather than
    // reading video.paused synchronously at mount — that read can race ahead
    // of the parent's own "start playback" effect (child effects run before
    // parent effects), which would read `paused: true` while the video is
    // simply still loading, not actually paused, and flash the icon on.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setPaused(false);
        const onPause = () => setPaused(true);

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        };
    }, [videoRef]);

    function handleTap(e: ReactMouseEvent<HTMLDivElement>) {
        e.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
    }

    return (
        <div className="absolute inset-0" onClick={handleTap}>
            {paused && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="glass flex h-16 w-16 items-center justify-center rounded-full">
                        <Play className="h-7 w-7 translate-x-0.5 fill-white text-white" />
                    </div>
                </div>
            )}
        </div>
    );
}