import type { CSSProperties, ReactNode } from 'react';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { ZoomBadge } from './ZoomBadge';

interface PinchZoomVideoProps {
    /** Extra classes for the outer container. */
    className?: string;
    /** Background behind the media (e.g. the blur backdrop) -- not zoomed. */
    backdrop?: ReactNode;
    /** The media element (a <video>), rendered with the zoom transform
     *  applied via the style handed to this render prop. */
    children: (style: CSSProperties) => ReactNode;
    /** Content layered above the media (tap overlay, progress bar) -- not
     *  zoomed, and left able to receive single taps (see below). */
    overlay?: ReactNode;
}

/**
 * Pinch-to-zoom / drag-to-pan wrapper for a video.
 *
 * Unlike {@link ZoomableImage} the double-tap-to-zoom is deliberately *off*
 * (see {@link usePinchZoom}) -- for videos a double tap is already the
 * rewind/fast-forward seek in VideoTapOverlay, so zoom is pinch-only.
 *
 * The container captures touches for the whole area (it is an ancestor of the
 * `overlay`, so two-finger pinches bubble up to it), while single taps still
 * reach the overlay's own click handler and, at rest, the feed's scroll/swipe
 * navigation is untouched -- the engine only intercepts two-finger pinches and
 * one-finger pans while zoomed in.
 */
export function PinchZoomVideo({ className, backdrop, children, overlay }: PinchZoomVideoProps) {
    const { containerRef, zoomed, transform, transformStyle } = usePinchZoom();

    return (
        <div ref={containerRef} className={className} style={{ touchAction: zoomed ? 'none' : undefined }}>
            {backdrop}
            {children(transformStyle)}
            {overlay}
            <ZoomBadge scale={transform.scale} />
        </div>
    );
}
