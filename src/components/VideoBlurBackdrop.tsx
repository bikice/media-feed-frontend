import { useEffect, useRef, type RefObject } from 'react';
import { BlurBackdrop } from './BlurBackdrop';

/** Target width of the offscreen mirror; the blur hides the low resolution and
 *  keeps the per-frame copy essentially free. */
const MIRROR_WIDTH = 48;
/** Frames per second for the mirror -- the backdrop is blurred beyond
 *  recognition, so a low rate is indistinguishable from a full-rate copy. */
const MIRROR_FPS = 12;

/**
 * Video counterpart of {@link BlurBackdrop}: fills the letterbox/pillarbox area
 * around an `object-contain` video with a blurred, upscaled copy of the video
 * *itself* instead of a still poster.
 *
 * Rather than mounting a second <video> (which would decode/download the stream
 * twice -- and is impossible for an HLS.js MSE source), the foreground element
 * is mirrored into a tiny canvas a few times per second and that canvas is
 * stretched over the slot and blurred by CSS. The poster stays underneath as the
 * fallback for the moments before the first frame is available.
 */
export function VideoBlurBackdrop({
    videoRef,
    posterUrl,
}: {
    videoRef: RefObject<HTMLVideoElement | null>;
    posterUrl: string | null;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let frame = 0;
        let last = 0;
        let stopped = false;

        const draw = (now: number) => {
            frame = requestAnimationFrame(draw);
            if (stopped) return;
            if (now - last < 1000 / MIRROR_FPS) return;
            last = now;

            const { videoWidth, videoHeight } = video;
            if (!videoWidth || !videoHeight || video.readyState < 2) return;
            if (document.hidden) return;

            const height = Math.max(1, Math.round((MIRROR_WIDTH * videoHeight) / videoWidth));
            if (canvas.width !== MIRROR_WIDTH || canvas.height !== height) {
                canvas.width = MIRROR_WIDTH;
                canvas.height = height;
            }
            try {
                ctx.drawImage(video, 0, 0, MIRROR_WIDTH, height);
                canvas.style.opacity = '1';
            } catch {
                // A tainted/undecodable frame (e.g. cross-origin native HLS):
                // keep the poster backdrop visible and stop trying.
                stopped = true;
                canvas.style.opacity = '0';
            }
        };

        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [videoRef]);

    return (
        <>
            <BlurBackdrop src={posterUrl} />
            <canvas
                ref={canvasRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-0 blur-2xl transition-opacity duration-300"
            />
        </>
    );
}
