interface LocationBadgeProps {
    /** Display title of the current provider, e.g. "Reddit". */
    providerLabel: string;
    /** The active `source` scoping the feed -- a raw slug like "r/wetspot"
     *  or "user/some_name" -- or null/undefined when the feed isn't scoped
     *  to one. */
    sourceLabel?: string | null;
}

function capitalizeFirst(s: string): string {
    return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** "r/wetspot" -> "R: Wetspot", "user/some_name" -> "User: Some name". Source
 *  slugs are "prefix/rest" (see slug.ts); the prefix gets its first letter
 *  capitalized, the rest has underscores turned into spaces and its first
 *  letter capitalized. A slug without a "/" is treated as just the "rest"
 *  part, with no prefix. */
function formatSourceLabel(source: string): string {
    const slashIndex = source.indexOf('/');
    if (slashIndex === -1) {
        return capitalizeFirst(source.replace(/_/g, ' '));
    }
    const prefix = capitalizeFirst(source.slice(0, slashIndex));
    const rest = capitalizeFirst(source.slice(slashIndex + 1).replace(/_/g, ' '));
    return `${prefix}: ${rest}`;
}

/**
 * Top-center "where am I" pill: current provider, then the source (if any)
 * the feed is currently scoped to. Sits above GalleryDots in FeedView's
 * top-center stack.
 */
export function LocationBadge({ providerLabel, sourceLabel }: LocationBadgeProps) {
    return (
        <div className="glass flex max-w-[80vw] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
            <span className="shrink-0 text-(--color-text)">{providerLabel}</span>
            {sourceLabel && (
                <>
                    <span className="shrink-0 text-(--color-text-dim)">/</span>
                    <span className="truncate text-(--color-text-dim)">{formatSourceLabel(sourceLabel)}</span>
                </>
            )}
        </div>
    );
}