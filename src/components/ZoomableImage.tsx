import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

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

const MIN_SCALE = 1;
const MAX_SCALE = 4;
// Scale a double tap jumps to (and back to MIN_SCALE from).
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_WINDOW_MS = 280;

function distance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/**
 * Wraps a single feed image with pinch-to-zoom.
 *
 * - Two-finger pinch zooms in/out, anchored on the midpoint between the
 *   fingers so the content under them stays put.
 * - A double tap toggles between the resting scale and {@link DOUBLE_TAP_SCALE},
 *   zooming towards the tapped point.
 * - While zoomed in, a one-finger drag pans the image, and the gesture is kept
 *   local (touch events stop propagating) so it doesn't scroll the vertical
 *   feed or swipe the horizontal gallery. At rest (scale 1) those gestures are
 *   left untouched so normal feed navigation keeps working.
 *
 * Touch listeners are attached manually as non-passive so the component can
 * call preventDefault -- React registers touch handlers as passive, which
 * would make that a no-op.
 */
export function ZoomableImage({ src, alt, loading, className, onToggleChrome }: ZoomableImageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    // Pending single-tap chrome toggle, deferred until we know a second tap
    // (which would be a double-tap zoom) isn't coming. Mirrors VideoTapOverlay.
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastClickTime = useRef(0);
    const [transform, setTransform] = useState({ scale: MIN_SCALE, tx: 0, ty: 0 });
    // Mutable gesture bookkeeping -- kept in a ref so the raw touch handlers
    // read/write the latest values without re-subscribing on every render.
    const gesture = useRef({
        scale: MIN_SCALE,
        tx: 0,
        ty: 0,
        startDist: 0,
        startScale: MIN_SCALE,
        startTx: 0,
        startTy: 0,
        midX: 0,
        midY: 0,
        panStartX: 0,
        panStartY: 0,
        pinching: false,
        panning: false,
        lastTapTime: 0,
    });

    // Keep the visual transform in sync and clamp pan so the zoomed image can't
    // be dragged past its own edges.
    function commit(scale: number, tx: number, ty: number) {
        const el = containerRef.current;
        const rect = el?.getBoundingClientRect();
        const maxX = rect ? ((scale - 1) * rect.width) / 2 : 0;
        const maxY = rect ? ((scale - 1) * rect.height) / 2 : 0;
        const cx = clamp(tx, -maxX, maxX);
        const cy = clamp(ty, -maxY, maxY);
        gesture.current.scale = scale;
        gesture.current.tx = cx;
        gesture.current.ty = cy;
        setTransform({ scale, tx: cx, ty: cy });
    }

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const g = gesture.current;

        function onTouchStart(e: TouchEvent) {
            if (e.touches.length === 2) {
                e.preventDefault();
                e.stopPropagation();
                g.pinching = true;
                g.panning = false;
                g.startDist = distance(e.touches[0], e.touches[1]);
                g.startScale = g.scale;
                g.startTx = g.tx;
                g.startTy = g.ty;
                const rect = el!.getBoundingClientRect();
                g.midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - rect.width / 2;
                g.midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - rect.height / 2;
            } else if (e.touches.length === 1) {
                const now = Date.now();
                if (now - g.lastTapTime < DOUBLE_TAP_WINDOW_MS) {
                    // Double tap: toggle zoom around the tapped point.
                    e.preventDefault();
                    e.stopPropagation();
                    g.lastTapTime = 0;
                    // Calling preventDefault above suppresses this tap's synthetic
                    // click, so handleClick's own double-tap cancellation won't run.
                    // Cancel the chrome toggle the first tap deferred here instead,
                    // otherwise a double tap would still toggle the chrome.
                    if (singleTapTimer.current !== null) {
                        clearTimeout(singleTapTimer.current);
                        singleTapTimer.current = null;
                    }
                    lastClickTime.current = 0;
                    const rect = el!.getBoundingClientRect();
                    const px = e.touches[0].clientX - rect.left - rect.width / 2;
                    const py = e.touches[0].clientY - rect.top - rect.height / 2;
                    if (g.scale > MIN_SCALE) {
                        commit(MIN_SCALE, 0, 0);
                    } else {
                        const s = DOUBLE_TAP_SCALE;
                        commit(s, -px * (s - 1), -py * (s - 1));
                    }
                    return;
                }
                g.lastTapTime = now;
                if (g.scale > MIN_SCALE) {
                    // Panning only matters while zoomed in; keep the gesture
                    // local so the feed doesn't scroll underneath.
                    g.panning = true;
                    g.panStartX = e.touches[0].clientX - g.tx;
                    g.panStartY = e.touches[0].clientY - g.ty;
                }
            }
        }

        function onTouchMove(e: TouchEvent) {
            if (g.pinching && e.touches.length === 2) {
                e.preventDefault();
                e.stopPropagation();
                const dist = distance(e.touches[0], e.touches[1]);
                const ratio = g.startDist > 0 ? dist / g.startDist : 1;
                const scale = clamp(g.startScale * ratio, MIN_SCALE, MAX_SCALE);
                // Keep the pinch midpoint anchored as the scale changes.
                const factor = scale / g.startScale;
                const tx = g.midX + (g.startTx - g.midX) * factor;
                const ty = g.midY + (g.startTy - g.midY) * factor;
                commit(scale, tx, ty);
            } else if (g.panning && e.touches.length === 1) {
                e.preventDefault();
                e.stopPropagation();
                commit(g.scale, e.touches[0].clientX - g.panStartX, e.touches[0].clientY - g.panStartY);
            }
        }

        function onTouchEnd(e: TouchEvent) {
            if (e.touches.length < 2) g.pinching = false;
            if (e.touches.length === 0) {
                g.panning = false;
                // Snap fully back so a slightly-under-1 pinch doesn't leave the
                // image offset, and drop any residual pan when back at rest.
                if (g.scale <= MIN_SCALE) commit(MIN_SCALE, 0, 0);
            }
        }

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    }, []);

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

    const zoomed = transform.scale > MIN_SCALE;

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
                style={{
                    transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
                    transformOrigin: 'center center',
                    transition: gesture.current.pinching || gesture.current.panning ? 'none' : 'transform 0.2s ease-out',
                    willChange: 'transform',
                }}
            />
        </div>
    );
}
