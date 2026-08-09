// Types mirror the MediaFeed OpenAPI schemas (MediaItem.*, ProviderInfo.*).
// Field names match the JSON the API actually returns (see samples.md),
// which is camelCase and slightly leaner than the full MediaItem.jsonld shape.

export type MediaType = 'image' | 'video' | 'hls' | 'gallery' | string;

export interface MediaUserRef {
  slug: string;
  name: string;
  profileIcon: string | null;
}

export interface MediaSubredditRef {
  slug: string;
  name: string;
  communityIcon: string | null;
}

/** One slide of a gallery item. Carries its own type since a gallery can mix
 *  static images, MP4 videos, and HLS streams. */
export interface GalleryItem {
  type: MediaType;
  mediaUrl: string;
  posterUrl?: string | null;
  caption?: string | null;
}

/** A single item as returned inside a /feed response's `items` array. */
export interface MediaItem {
  id: string;
  provider: string;
  type: MediaType;
  mediaUrl: string | null;
  posterUrl: string | null;
  user: MediaUserRef;
  timestamp: number; // unix seconds
  subreddit: MediaSubredditRef | null;
  title: string | null;
  flairName: string | null;
  votes: number;
  gallery: GalleryItem[] | null;
  permalink: string | null;
  nsfw: boolean;
  caption: string | null;
}

export interface FeedPagination {
  before: string | null;
  after: string | null;
}

export interface FeedResponse {
  items: MediaItem[];
  pagination: FeedPagination;
  availableFlairs: string[] | null;
}

export interface FeedParamSpec {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum: string[] | null;
  default: string | number | null;
  min: number | null;
  max: number | null;
}

export interface ProviderInfo {
  slug: string;
  title: string;
  feedParams: FeedParamSpec[];
  /** Provider-curated example sources, meant to be offered as quick-pick
   *  suggestions before the user has typed or picked a source of their own.
   *  Same shape as an instant-search source (see InstantSearchSource) --
   *  selecting one sets `source`, not `q`. */
  defaultSources: InstantSearchSource[];
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
}

/** One entry in an instant-search response's merged `sources` list. `type`
 *  is provider-defined (seen so far: "subreddit", "user", "niche", "tag")
 *  and is purely a display hint -- every entry resolves to the feed's
 *  `source` filter the same way regardless of type. */
export interface InstantSearchSource {
  slug: string;
  name: string;
  type: string;
  icon: string | null;
}

export interface InstantSearchResponse {
  queries: string[];
  sources: InstantSearchSource[];
}

export interface AuthTokens {
  token: string;
  refreshToken: string | null;
}

export interface FeedQuery {
  q?: string;
  source?: string;
  flair?: string;
  order?: string;
  limit?: number;
}