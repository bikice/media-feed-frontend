import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import { Play } from 'lucide-react';

interface VideoTapOverlayProps {
    /** Ref to the underlying <video> element this overlay controls. */
    videoRef: RefObject<HTMLVideoElement | null>;
}

// A second tap landing within this window of the first is treated as a
// double tap (seek) rather than two separate single taps (play/pause).
// This is also how long a single tap's play/pause is deferred, waiting to
// see whether a second tap is coming.
const DOUBLE_TAP_WINDOW_MS = 280;

/**
 * Transparent full-size layer over a <video>.
 *
 * - A single tap anywhere toggles play/pause.
 * - A double tap on the left third rewinds, and on the right third fast-
 *   forwards -- reusing the exact seek behaviour (step sizing, preview
 *   indicator, double-press stacking) wired up in useFeedNavigation by
 *   dispatching the same MediaRewind/MediaFastForward key events it listens
 *   for. A double tap deliberately does *not* play/pause the video.
 *
 * Sits below the progress bar and gallery controls (both stop propagation /
 * paint above it), so it never steals those taps.
 */
export function VideoTapOverlay({ videoRef }: VideoTapOverlayProps) {
    const [paused, setPaused] = useState(false);
    // Pending single-tap play/pause, deferred until we know a second tap
    // isn't coming. Cleared/replaced on each tap -- see handleTap.
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTapTime = useRef(0);

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

    // Toggle play/pause on the underlying video -- the single-tap action,
    // fired once we're confident no second tap is following.
    function togglePlayPause() {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
    }

    // Seek by synthesising the same media key events useFeedNavigation
    // already handles, so double-tap seeking shares all of its behaviour
    // (duration-scaled step, preview indicator, repeat-tap stacking) for
    // free rather than reimplementing it here.
    function seek(direction: 'forward' | 'backward') {
        const key = direction === 'forward' ? 'MediaFastForward' : 'MediaRewind';
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
        window.dispatchEvent(new KeyboardEvent('keyup', { key }));
    }

    function handleTap(e: ReactMouseEvent<HTMLDivElement>) {
        e.stopPropagation();

        const now = Date.now();
        const sincePrev = now - lastTapTime.current;
        lastTapTime.current = now;

        // Second tap within the window -> double tap: cancel the pending
        // single-tap play/pause and seek based on which third was tapped.
        if (singleTapTimer.current !== null && sincePrev < DOUBLE_TAP_WINDOW_MS) {
            clearTimeout(singleTapTimer.current);
            singleTapTimer.current = null;
            // Reset so a third quick tap starts a fresh single/double cycle
            // rather than immediately counting as another double tap.
            lastTapTime.current = 0;

            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            if (ratio < 1 / 3) seek('backward');
            else if (ratio > 2 / 3) seek('forward');
            // Middle third: no seek (and, per spec, no play/pause either).
            return;
        }

        // First tap: defer play/pause briefly in case a second tap turns
        // this into a double-tap seek.
        singleTapTimer.current = setTimeout(() => {
            singleTapTimer.current = null;
            togglePlayPause();
        }, DOUBLE_TAP_WINDOW_MS);
    }

    // Don't leave a deferred single-tap toggle pending across unmount.
    useEffect(() => {
        return () => {
            if (singleTapTimer.current !== null) clearTimeout(singleTapTimer.current);
        };
    }, []);

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