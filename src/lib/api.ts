import { apiFetch, toQueryString, withBase } from './http';
import type { FeedQuery, FeedResponse, GalleryItem, InstantSearchResponse, MediaItem, ProviderInfo } from '@/types';

function inferTypeFromUrl(url: string): string {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video';
  return 'image';
}

/** Coerce one gallery entry into a well-formed GalleryItem, tolerating a
 *  backend that sends bare URL strings instead of {type, mediaUrl, ...}. */
function normalizeGalleryItem(raw: unknown): GalleryItem | null {
  if (typeof raw === 'string') {
    return { type: inferTypeFromUrl(raw), mediaUrl: withBase(raw), posterUrl: null };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const mediaUrl = obj.mediaUrl ?? obj.url ?? obj.src;
    if (typeof mediaUrl !== 'string') return null;
    return {
      type: typeof obj.type === 'string' ? obj.type : inferTypeFromUrl(mediaUrl),
      mediaUrl: withBase(mediaUrl),
      posterUrl: typeof obj.posterUrl === 'string' ? withBase(obj.posterUrl) : null,
      caption: typeof obj.caption === 'string' ? obj.caption : null,
    };
  }
  return null;
}

function normalizeMediaItem(item: MediaItem): MediaItem {
  const resolved: MediaItem = {
    ...item,
    mediaUrl: item.mediaUrl ? withBase(item.mediaUrl) : item.mediaUrl,
    posterUrl: item.posterUrl ? withBase(item.posterUrl) : item.posterUrl,
  };
  if (!resolved.gallery) return resolved;
  const gallery = resolved.gallery
      .map(normalizeGalleryItem)
      .filter((g): g is GalleryItem => g !== null);
  return { ...resolved, gallery: gallery.length > 0 ? gallery : null };
}

// ---- Auth -----------------------------------------------------------------

export async function login(email: string, password: string): Promise<{ token: string }> {
  return apiFetch('/api/login_check', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(refreshToken: string): Promise<void> {
  return apiFetch('/api/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

// ---- Providers --------------------------------------------------------------

export async function getProviders(): Promise<ProviderInfo[]> {
  const data = await apiFetch<
  { 'hydra:member'?: ProviderInfo[] } | { providers?: ProviderInfo[] } | ProviderInfo[]
  >('/api/providers');
  const list = Array.isArray(data)
      ? data
      : (('hydra:member' in data && data['hydra:member']) || ('providers' in data && data.providers) || []) as ProviderInfo[];
  // Provider icons/logos are also plausibly relative URLs -- adjust the
  // field name(s) here if ProviderInfo carries an icon/logo/avatar url.
  return list;
}

// ---- Feed -------------------------------------------------------------------

export async function getFeed(
    provider: string,
    query: FeedQuery & { before?: string; after?: string; page?: number } = {},
): Promise<FeedResponse> {
  const qs = toQueryString({
    q: query.q,
    source: query.source,
    flair: query.flair,
    before: query.before,
    after: query.after,
    limit: query.limit,
    order: query.order,
    page: query.page,
  });
  return apiFetch<FeedResponse>(`/api/providers/${encodeURIComponent(provider)}/feed${qs}`).then(
      (res) => ({ ...res, items: res.items.map(normalizeMediaItem) }),
  );
}

export async function getMediaDetail(provider: string, id: string): Promise<MediaItem> {
  const item = await apiFetch<MediaItem>(
      `/api/providers/${encodeURIComponent(provider)}/media/${encodeURIComponent(id)}`,
  );
  return normalizeMediaItem(item);
}

export async function trackView(
    provider: string,
    id: string,
    query: Pick<FeedQuery, 'q' | 'source' | 'flair' | 'order'>,
    galleryIndex?: number,
): Promise<void> {
  const body: Record<string, string> = {};
  if (query.q) body.query = query.q;
  if (query.source) body.source = query.source;
  if (query.flair) body.flair = query.flair;
  if (query.order) body.order = query.order;
  if (galleryIndex) body.galleryIndex = String(galleryIndex); // 0 = default/first slide, omit
  await apiFetch<void>(
      `/api/providers/${encodeURIComponent(provider)}/media/${encodeURIComponent(id)}/track`,
      { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function getAdminTrackingSearch(
    q: string,
): Promise<InstantSearchResponse> {
  const qs = toQueryString({ q });
  return apiFetch<InstantSearchResponse>(`/api/admin/tracking/search/instant${qs}`);
}

export async function getAdminTrackingFeed(
    source: string,
    opts?: { before?: string; after?: string; order?: string; limit?: number },
): Promise<FeedResponse> {
  const qs = toQueryString({
    source,
    before: opts?.before,
    after: opts?.after,
    order: opts?.order,
    limit: opts?.limit,
  });
  return apiFetch<FeedResponse>(`/api/admin/tracking/feed${qs}`).then(
      (res) => ({ ...res, items: res.items.map(normalizeMediaItem) }),
  );
}

export async function getInstantSearch(
    provider: string,
    q: string,
    source?: string,
): Promise<InstantSearchResponse> {
  const qs = toQueryString({ q, source });
  return apiFetch<InstantSearchResponse>(
      `/api/providers/${encodeURIComponent(provider)}/search/instant${qs}`,
  );
}