interface GalleryDotsProps {
    count: number;
    index: number;
}

/**
 * "n / total" pill + dot row showing position within the active card's
 * gallery. Purely presentational -- positioning is left to the caller (see
 * FeedView, which stacks this under LocationBadge in a top-center column).
 */
export function GalleryDots({ count, index }: GalleryDotsProps) {
    if (count <= 1) return null;
    return (
        <div className="flex items-center gap-2">
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