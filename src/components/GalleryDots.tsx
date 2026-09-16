interface GalleryDotsProps {
    count: number;
    index: number;
}

/** Geometry of the dot row, in px. Each dot occupies a fixed STEP (dot + gap),
 *  so positions are simple multiples and the whole row can be slid with a
 *  single translateX. */
const DOT = 6; // dot diameter (matches h-1.5 / w-1.5)
const GAP = 4; // space between dots
const STEP = DOT + GAP;
const MAX_VISIBLE = 7; // how many dots are shown at once before we start sliding
const VIEWPORT = MAX_VISIBLE * STEP - GAP; // width that fits exactly MAX_VISIBLE dots

/**
 * "n / total" pill + dot row showing position within the active card's
 * gallery. Purely presentational -- positioning is left to the caller (see
 * FeedView, which stacks this under LocationBadge in a top-center column).
 *
 * For galleries with more than MAX_VISIBLE items the dot row becomes a sliding
 * window: the active dot is kept centered (until the very start/end of the
 * gallery) and the whole row translates with a tiny animation so it's clear
 * the dots are moving. Dots at the edge of the window shrink to hint that
 * there are more beyond.
 */
export function GalleryDots({ count, index }: GalleryDotsProps) {
    if (count <= 1) return null;

    const windowed = count > MAX_VISIBLE;

    // First visible dot: keep the active dot centered, clamped so we never
    // scroll past either end of the gallery.
    const half = Math.floor(MAX_VISIBLE / 2);
    const start = windowed
        ? Math.min(Math.max(index - half, 0), count - MAX_VISIBLE)
        : 0;
    const end = start + MAX_VISIBLE - 1;
    const translate = -start * STEP;

    return (
        <div className="flex items-center gap-2">
            <div className="glass rounded-full px-2.5 py-1 font-(family-name:--font-mono) text-[11px] text-(--color-text-dim)">
                {index + 1} / {count}
            </div>
            <div className="overflow-hidden" style={{ width: windowed ? VIEWPORT : undefined }}>
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ gap: GAP, transform: windowed ? `translateX(${translate}px)` : undefined }}
                >
                    {Array.from({ length: count }).map((_, i) => {
                        // Shrink the dots sitting at the edge of the window when
                        // there are more dots hidden beyond that edge.
                        const p = i - start;
                        let scale = 1;
                        if (windowed) {
                            if (start > 0 && p === 0) scale = 0.5;
                            else if (start > 0 && p === 1) scale = 0.75;
                            else if (end < count - 1 && p === MAX_VISIBLE - 1) scale = 0.5;
                            else if (end < count - 1 && p === MAX_VISIBLE - 2) scale = 0.75;
                        }
                        return (
                            <span
                                key={i}
                                style={{ width: DOT, height: DOT, transform: `scale(${scale})` }}
                                className={`shrink-0 rounded-full transition-all duration-300 ease-out ${
                                    i === index ? 'bg-(--color-pink)' : 'bg-white/25'
                                }`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}