/**
 * Fills the empty letterbox/pillarbox area left by an `object-contain` media
 * element with a blurred, upscaled copy of the same image/poster. The backdrop
 * covers the whole slot (`object-cover`) and is centered, so the visible area is
 * filled without stretching the foreground media.
 */
export function BlurBackdrop({ src }: { src: string | null }) {
    if (!src) return null;
    return (
        <img
            src={src}
            alt=""
            aria-hidden
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
        />
    );
}
