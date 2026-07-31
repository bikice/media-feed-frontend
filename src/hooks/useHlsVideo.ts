import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { loadTokens } from '@/lib/tokenStorage';

interface UseHlsVideoOptions {
  /** Signed playlist URL, or null/undefined while it's still being fetched. */
  src: string | null | undefined;
  /** Only attach/play the stream when true. Lets the caller windowed-render. */
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
 * whenever the item goes inactive or unmounts so off-screen items don't leak
 * decoders or keep sockets open.
 */
export function useHlsVideo({ src, active }: UseHlsVideoOptions): UseHlsVideoResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    setIsReady(false);
    setError(null);

    if (!video || !src || !active) {
      return () => {
        hlsRef.current?.destroy();
        hlsRef.current = null;
      };
    }

    if (Hls.isSupported()) {
      const { token } = loadTokens();
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        },
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setIsReady(true));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError('Playback error — this stream could not be loaded.');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS: native HLS support, no auth header injection possible,
      // relies on the proxy's signed URL for access control.
      video.src = src;
      setIsReady(true);
    } else {
      setError('HLS playback is not supported in this browser.');
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src, active]);

  return { videoRef, isReady, error };
}
