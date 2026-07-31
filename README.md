# MediaFeed

A TikTok-style, full-screen vertical media feed for the MediaFeed backend
(reddit-style providers, image/video/HLS items, galleries). Built with Vite,
React 19, TypeScript, Tailwind CSS v4, lucide-react, and HLS.js.

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_PROXY_TARGET at your backend
npm run dev
```

The dev server proxies `/api` and `/hls-proxy` to `VITE_API_PROXY_TARGET`
(defaults to `http://localhost:8080`) so the browser can call same-origin
paths without CORS trouble. In production, deploy this build behind the same
reverse proxy/origin as the API (or add your own proxy rule) so `/api` and
`/hls-proxy` resolve correctly.

```bash
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build locally
```

## Architecture

```
src/
  lib/
    http.ts          Fetch wrapper: attaches Bearer token, retries once
                      through /api/token/refresh on 401, single-flights
                      concurrent refreshes.
    api.ts            Typed endpoint functions (login, feed, providers,
                      instant search, signed HLS playlist URL).
    tokenStorage.ts   localStorage persistence for the JWT + refresh token.
  context/AuthContext.tsx   Login state, session persistence, logout.
  hooks/
    useAuth.ts              Thin context consumer.
    useInfiniteFeed.ts      Pagination + the 5-item DOM window.
    useFeedNavigation.ts    Arrow keys + swipe gestures (vertical feed /
                            horizontal gallery).
    useHlsVideo.ts          HLS.js lifecycle: auth headers, teardown.
    useDebouncedValue.ts    Debounce helper for the search box.
  components/
    AuthGuard.tsx     Redirects to LoginScreen when logged out.
    LoginScreen.tsx   Glassmorphic auth form.
    FeedView.tsx      Scroll-snap feed, IntersectionObserver-driven active
                      index, wires navigation + windowing together.
    MediaCard.tsx     Renders one item: image, video, HLS, or gallery.
    HlsPlayer.tsx     Fetches the signed playlist URL, plays via useHlsVideo.
    Sidebar.tsx       Provider switcher, search, dynamic sort/flair filters.
    OverlayNav.tsx    Mute toggle, sidebar toggle, account menu.
```

### Auth flow

`POST /api/login_check` returns a JWT (`token`). The refresh endpoint
(`/api/token/refresh`) and revoke endpoint (`/api/logout`) both take a
`refresh_token` in the body; this app stores both in `localStorage` and
attaches `Authorization: Bearer <token>` to every `/api/**` request. On a
401, `http.ts` calls the refresh endpoint once and retries the original
request before giving up and clearing the session.

### Performance: windowed rendering

`useInfiniteFeed` tracks the active index and exposes a `windowIndices` set
(active ± 2). `FeedView` only mounts a full `MediaCard` for items in that
set; everything else renders as an empty spacer `<div>` so the scroll-snap
container keeps correct scroll height without keeping five-plus video
decoders or large images alive. Within that window, `MediaCard` only mounts
a live `<video>`/`HlsPlayer` for the active item ± 1 — the outer two slots
show a static poster frame. HLS instances are fully `destroy()`ed by
`useHlsVideo`'s cleanup whenever an item leaves that inner ±1 range.

Infinite scroll fetches the next page once fewer than 2 unseen items remain
after the active index.

### Streaming

For HLS items, the feed response's `mediaUrl` (or the relevant `gallery`
entry) is already rewritten by the backend to the signed `/hls-proxy` URL
pointing at the origin's `.m3u8` manifest — there's no separate lookup call.
`MediaCard` detects HLS items by `type === 'hls'` or a `.m3u8` URL and hands
that URL straight to `HlsPlayer`, which loads it with `useHlsVideo`.
`useHlsVideo` still attaches `Authorization: Bearer <token>` via HLS.js's
`xhrSetup` on every playlist/segment request, in case the proxy also checks
the bearer token in addition to the URL signature.

### Design

Dark theme (`#0a0a0c`) with purple (`#9333ea`) → pink (`#ec4899`) gradient
accents, per the brief. Space Grotesk for display type, Inter for body/UI,
JetBrains Mono for the gallery counter and small data labels. Glassmorphic
panels (`backdrop-filter: blur`) for the login card, overlay nav, and
sidebar; slow-drifting ambient glow blobs behind the login screen as the one
deliberate animation flourish, kept out of the feed itself so it doesn't
compete with the media.

### Gallery items

A `gallery` is an array of objects, not bare URL strings — each slide can be
a different media type (`{ type, mediaUrl, posterUrl?, caption? }`), since a
single gallery can mix images, MP4 videos, and HLS streams. `MediaCard`
resolves the active slide's own `type`/`mediaUrl`/`posterUrl` rather than
inheriting the parent item's, so a video slide inside an otherwise-image
gallery still plays correctly. `lib/api.ts`'s `normalizeMediaItem` also
tolerates a backend that sends bare strings for `gallery` entries (coercing
them into `{ type: <inferred from extension>, mediaUrl }`), so a shape
mismatch degrades gracefully instead of leaking a raw object into a URL
slot.
