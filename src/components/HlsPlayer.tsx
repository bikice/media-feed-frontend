import { AlertCircle } from 'lucide-react';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { VideoProgressBar } from './VideoProgressBar';
import { VideoTapOverlay } from './VideoTapOverlay';

interface HlsPlayerProps {
    /**
     * The item's `mediaUrl` (or the active `gallery` entry). For HLS items the
     * backend already rewrites this to the signed `/hls-proxy` URL pointing at
     * the origin's `.m3u8` manifest, so it can be handed to HLS.js as-is --
     * no separate lookup call needed.
     */
    url: string;
    posterUrl: string | null;
    /**
     * Whether this instance should be playing right now. This component is
     * mounted for the whole active ± 1 window (see MediaCard), so a `false`
     * value here doesn't mean "don't load" -- the stream still attaches and
     * buffers in the background via useHlsVideo; it just stays paused until
     * this flips true.
     */
    active: boolean;
    muted: boolean;
}

export function HlsPlayer({ url, posterUrl, active, muted }: HlsPlayerProps) {
    const { videoRef, error } = useHlsVideo({ src: url, active });

    if (error) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-(--color-text-dim)">
                <AlertCircle className="h-6 w-6" />
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full">
            <video
                ref={videoRef}
                poster={posterUrl ?? undefined}
                muted={muted}
                loop
                autoPlay={active}
                playsInline
                preload="auto"
                className="h-full w-full object-contain"
            />
            {active && <VideoTapOverlay videoRef={videoRef} />}
            {active && <VideoProgressBar videoRef={videoRef} />}
        </div>
    );
}