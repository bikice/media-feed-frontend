import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { loadTokens } from '@/lib/tokenStorage';

interface UseHlsVideoOptions {
  /** Signed playlist URL, or null/undefined while it's still being fetched. */
  src: string | null | undefined;
  /**
   * Whether this instance should currently be *playing*. This no longer
   * gates attaching the stream (see below) -- it only drives play()/pause().
   */
  active: boolean;
}

interface UseHlsVideoResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isReady: boolean;
  error: string | null;
}

/**
 * Attaches an HLS.js instance (or native HLS on Safari) to a <video> element,
 * forwarding the bearer token on every playlist/segment request in case the
 * proxy is deployed behind auth, and tearing the instance down completely
 * whenever the item unmounts so off-screen items don't leak decoders or keep
 * sockets open.
 *
 * Attaching/buffering is driven purely by mounting this hook at all (i.e. by
 * the caller's `shouldMount` windowing, active ± 1) -- NOT by `active`. That
 * way the manifest fetch + initial segment buffering for the next/previous
 * item starts as soon as it enters the window, instead of only once someone
 * has already swiped to it. `active` is used solely to start/stop playback
 * on a stream that (ideally) is already buffered by the time it matters.
 */
export function useHlsVideo({ src, active }: UseHlsVideoOptions): UseHlsVideoResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attach / tear down the stream whenever `src` changes. Intentionally does
  // NOT depend on `active` -- see note above.
  useEffect(() => {
    const video = videoRef.current;
    setIsReady(false);
    setError(null);

    if (!video || !src) {
      return () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }

    let cancelled = false;

    async function attach(video: HTMLVideoElement, src: string) {
      // hls.js is a sizeable dependency (~250kB) that only matters for the
      // subset of items that are actually HLS streams, so it's dynamically
      // imported here instead of statically at the top of the file. Vite
      // splits it into its own chunk, fetched once, on first use.
      const { default: HlsCtor } = await import('hls.js');
      if (cancelled) return;

      if (HlsCtor.isSupported()) {
        const { token } = loadTokens();
        const hls = new HlsCtor({
          xhrSetup: (xhr) => {
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        // Just marks the manifest as parsed / buffering underway. Whether to
        // actually call play() is left entirely to the active-driven effect
        // below, so a preloading neighbor buffers quietly instead of playing
        // off-screen.
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => setIsReady(true));
        hls.on(HlsCtor.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setError('Playback error — this stream could not be loaded.');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari / iOS: native HLS support, no auth header injection possible,
        // relies on the proxy's signed URL for access control. Setting `src`
        // (with preload="auto" on the element) is enough to start buffering
        // without a play() call.
        video.src = src;
        setIsReady(true);
      } else {
        setError('HLS playback is not supported in this browser.');
      }
    }

    attach(video, src);

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // Drive play/pause purely off `active` (once the stream is ready), kept
  // separate from the attach effect so becoming active never re-triggers the
  // (slow) manifest fetch -- it just unpauses a stream that's ideally
  // already buffered from when it was a preloading neighbor.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    if (active) {
      video.play().catch(() => {
        // Autoplay was blocked (e.g. no user gesture yet); the tap overlay
        // lets the person start it manually.
      });
    } else {
      video.pause();
    }
  }, [active, isReady]);

  return { videoRef, isReady, error };
}