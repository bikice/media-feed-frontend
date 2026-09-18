interface ZoomBadgeProps {
    /** Current zoom scale (1 = resting). The badge only renders while zoomed. */
    scale: number;
}

/**
 * Small pill showing the current zoom level as a percentage (e.g. "150%").
 *
 * Only rendered while the media is actually zoomed in (scale > 1); at rest it
 * shows nothing. Unlike the media-type badge and the bottom metadata, this is
 * *not* tied to the feed's chrome visibility -- it stays on screen whenever
 * there's an active zoom, since it reflects a transient gesture state the user
 * is in the middle of, regardless of whether the chrome is hidden.
 *
 * Positioned in the top-left corner, tucked just below the media-type badge,
 * so it doesn't sit under the top-right menu button (OverlayNav).
 */
export function ZoomBadge({ scale }: ZoomBadgeProps) {
    if (scale <= 1) return null;
    return (
        <div
            className="glass pointer-events-none absolute left-4 z-20 flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-(--color-text)"
            style={{ top: 'calc(max(1rem, env(safe-area-inset-top)) + 2.5rem)' }}
        >
            {Math.round(scale * 100)}%
        </div>
    );
}
