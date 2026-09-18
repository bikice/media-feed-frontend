import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { DOUBLE_TAP_WINDOW_MS, usePinchZoom } from '@/hooks/usePinchZoom';
import { ZoomBadge } from './ZoomBadge';

interface ZoomableImageProps {
    src: string;
    alt: string;
    loading?: 'eager' | 'lazy';
    /** Extra classes for the <img>. Kept identical to the non-zoomable
     *  rendering so the resting (un-zoomed) layout is unchanged. */
    className?: string;
    /** Toggle the feed's UI chrome -- the single-tap action, matching the
     *  behaviour videos get from VideoTapOverlay. A double tap (zoom) is
     *  deliberately excluded from this. */
    onToggleChrome: () => void;
}

/**
 * Wraps a single feed image with pinch-to-zoom.
 *
 * The pinch/pan/double-tap gesture engine lives in {@link usePinchZoom}
 * (shared with the video players); this component adds the image-specific
 * behaviour on top: owning the single-tap chrome toggle and excluding the
 * double-tap (zoom) from it.
 */
export function ZoomableImage({ src, alt, loading, className, onToggleChrome }: ZoomableImageProps) {
    // Pending single-tap chrome toggle, deferred until we know a second tap
    // (which would be a double-tap zoom) isn't coming. Mirrors VideoTapOverlay.
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClickTime = useRef(0);

    function cancelPendingToggle() {
        if (singleTapTimer.current !== null) {
            clearTimeout(singleTapTimer.current);
            singleTapTimer.current = null;
        }
        lastClickTime.current = 0;
    }

    const { containerRef, zoomed, transform, transformStyle } = usePinchZoom({
        doubleTapZoom: true,
        // A double-tap's preventDefault suppresses the second synthetic click,
        // so handleClick's own double-tap cancellation won't run -- cancel the
        // first tap's deferred chrome toggle here instead, otherwise a double
        // tap would still toggle the chrome.
        onDoubleTap: cancelPendingToggle,
    });

    // Don't leave a deferred single-tap toggle pending across unmount.
    useEffect(() => {
        return () => {
            if (singleTapTimer.current !== null) clearTimeout(singleTapTimer.current);
        };
    }, []);

    // Own the chrome toggle here (rather than letting the tap bubble up to the
    // feed container) so a double tap can be excluded: the second click cancels
    // the deferred single-tap toggle. stopPropagation keeps the feed container's
    // onClick from also toggling.
    function handleClick(e: ReactMouseEvent<HTMLDivElement>) {
        e.stopPropagation();
        const now = Date.now();
        const sincePrev = now - lastClickTime.current;
        lastClickTime.current = now;

        if (singleTapTimer.current !== null && sincePrev < DOUBLE_TAP_WINDOW_MS) {
            // Second tap within the window -> double tap: cancel the pending
            // chrome toggle (the double tap zooms instead) and reset so a third
            // quick tap starts a fresh single/double cycle.
            clearTimeout(singleTapTimer.current);
            singleTapTimer.current = null;
            lastClickTime.current = 0;
            return;
        }

        singleTapTimer.current = setTimeout(() => {
            singleTapTimer.current = null;
            onToggleChrome();
        }, DOUBLE_TAP_WINDOW_MS);
    }

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full"
            style={{ touchAction: zoomed ? 'none' : undefined }}
            onClick={handleClick}
        >
            <img
                src={src}
                alt={alt}
                loading={loading}
                draggable={false}
                className={className}
                style={transformStyle}
            />
            <ZoomBadge scale={transform.scale} />
        </div>
    );
}
