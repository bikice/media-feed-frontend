/** Source slugs (e.g. "r/wetspot/" or "user/wetspot/") come back from the API
 *  with a trailing slash in some contexts (instant search, item.subreddit)
 *  but the feed endpoint doesn't want -- and shouldn't echo back -- that
 *  slash once the slug becomes the active `source` filter. */
export function stripTrailingSlash(slug: string): string {
    return slug.replace(/\/+$/, '');
}