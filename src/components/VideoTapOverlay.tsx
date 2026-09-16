import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

interface VideoTapOverlayProps {
    /** Toggle the feed's UI chrome -- the single-tap action. */
    onToggleChrome: () => void;
}

// A second tap landing within this window of the first is treated as a
// double tap (seek) rather than two separate single taps. This is also how
// long a single tap's chrome toggle is deferred, waiting to see whether a
// second tap is coming.
const DOUBLE_TAP_WINDOW_MS = 280;

/**
 * Transparent full-size layer over a <video>.
 *
 * - A single tap anywhere toggles the feed's UI chrome (deliberately *not*
 *   play/pause -- videos keep playing on their own).
 * - A double tap on the left third rewinds, and on the right third fast-
 *   forwards -- reusing the exact seek behaviour (step sizing, preview
 *   indicator, double-press stacking) wired up in useFeedNavigation by
 *   dispatching the same MediaRewind/MediaFastForward key events it listens
 *   for. A double tap deliberately does *not* toggle the chrome.
 *
 * Sits below the progress bar and gallery controls (both stop propagation /
 * paint above it), so it never steals those taps.
 */
export function VideoTapOverlay({ onToggleChrome }: VideoTapOverlayProps) {
    // Pending single-tap chrome toggle, deferred until we know a second tap
    // isn't coming. Cleared/replaced on each tap -- see handleTap.
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastTapTime = useRef(0);

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
        // single-tap chrome toggle and seek based on which third was tapped.
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
            // Middle third: no seek (and, per spec, no chrome toggle either).
            return;
        }

        // First tap: defer the chrome toggle briefly in case a second tap
        // turns this into a double-tap seek.
        singleTapTimer.current = setTimeout(() => {
            singleTapTimer.current = null;
            onToggleChrome();
        }, DOUBLE_TAP_WINDOW_MS);
    }

    // Don't leave a deferred single-tap toggle pending across unmount.
    useEffect(() => {
        return () => {
            if (singleTapTimer.current !== null) clearTimeout(singleTapTimer.current);
        };
    }, []);

    return <div className="absolute inset-0" onClick={handleTap} />;
}
