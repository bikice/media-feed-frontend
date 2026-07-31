import { apiFetch, toQueryString } from './http';
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
    return { type: inferTypeFromUrl(raw), mediaUrl: raw, posterUrl: null };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const mediaUrl = obj.mediaUrl ?? obj.url ?? obj.src;
    if (typeof mediaUrl !== 'string') return null;
    return {
      type: typeof obj.type === 'string' ? obj.type : inferTypeFromUrl(mediaUrl),
      mediaUrl,
      posterUrl: typeof obj.posterUrl === 'string' ? obj.posterUrl : null,
      caption: typeof obj.caption === 'string' ? obj.caption : null,
    };
  }
  return null;
}

function normalizeMediaItem(item: MediaItem): MediaItem {
  if (!item.gallery) return item;
  const gallery = item.gallery
    .map(normalizeGalleryItem)
    .filter((g): g is GalleryItem => g !== null);
  return { ...item, gallery: gallery.length > 0 ? gallery : null };
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
  if (Array.isArray(data)) return data;
  if ('hydra:member' in data && data['hydra:member']) return data['hydra:member'];
  if ('providers' in data && data.providers) return data.providers;
  return [];
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


