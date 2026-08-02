import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UseFeedNavigationOptions {
  /** Scrollable snap container for the main vertical feed. */
  containerRef: RefObject<HTMLElement | null>;
  itemCount: number;
  activeIndex: number;
  scrollToIndex: (index: number) => void;
  /** True when the currently-active item is a multi-image/video gallery. */
  isGalleryActive: boolean;
  galleryIndex: number;
  galleryLength: number;
  onGalleryChange: (index: number) => void;
  /** Whether the discovery sidebar is currently open. While it's open, the
   *  sidebar owns D-pad/arrow input (see useSpatialNavigation), so this
   *  hook stands down entirely rather than fighting over key events. */
  sidebarOpen: boolean;
  /** Opens the sidebar -- invoked when ArrowRight is pressed at the "right
   *  edge" of the feed, i.e. there's no further gallery slide to page to
   *  (or the active item has no gallery at all). */
  onOpenSidebar: () => void;
  /** Toggles the feed's UI chrome (OverlayNav, media-type badge, bottom
   *  gradient + metadata text) -- invoked on Select/Enter, letting someone
   *  clear the screen for an unobstructed view of the media. */
  onToggleChrome: () => void;
}

/** Which way the active video is currently being scrubbed, and the
 *  cumulative offset (always positive; the direction carries the sign) --
 *  driven by MediaFastForward/MediaRewind, see `useFeedNavigation` below.
 *  `null` means no seek is in progress / recently finished. */
export interface SeekPreview {
  direction: 'forward' | 'backward';
  totalSeconds: number;
}

const SWIPE_THRESHOLD_PX = 50;

// Fast-forward jumps further per press than rewind -- mirrors how most
// remotes/TV apps bias towards skipping ahead over backing up.
const FAST_FORWARD_STEP_SECONDS = 30;
const REWIND_STEP_SECONDS = 10;
// How long a press has to be held before it starts auto-repeating.
const SEEK_HOLD_DELAY_MS = 400;
// Cadence of the auto-repeat once a press has been held past the delay
// above -- each tick applies one more step, so holding "stacks" them.
const SEEK_REPEAT_INTERVAL_MS = 350;
// After release, how long the preview indicator lingers before fading --
// long enough that a quick single tap still gets visible feedback.
const SEEK_PREVIEW_LINGER_MS = 800;

/**
 * Wires up:
 *  - ArrowUp/ArrowDown -> move one item up/down in the main vertical feed
 *  - ArrowLeft/ArrowRight -> page through the active item's gallery (if any)
 *  - MediaPlayPause / Space -> toggle play/pause on the active item's video/HLS player
 *  - MediaFastForward/MediaRewind -> seek the active item's video/HLS player,
 *    30s/10s per press; holding a key repeats (stacks) the same step on an
 *    interval for as long as it's held. `seekPreview` (the hook's return
 *    value) tracks the in-progress direction + cumulative offset so the
 *    caller can render a preview indicator over the video.
 *  - Horizontal touch swipe on the active card -> gallery paging
 * Vertical touch/scroll navigation is handled natively via CSS scroll-snap
 * on the container, so this hook does not duplicate that logic.
 */
export function useFeedNavigation({
                                    containerRef,
                                    itemCount,
                                    activeIndex,
                                    scrollToIndex,
                                    isGalleryActive,
                                    galleryIndex,
                                    galleryLength,
                                    onGalleryChange,
                                    sidebarOpen,
                                    onOpenSidebar,
                                    onToggleChrome,
                                  }: UseFeedNavigationOptions): { seekPreview: SeekPreview | null } {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [seekPreview, setSeekPreview] = useState<SeekPreview | null>(null);
  // Which direction (if any) is currently being held down, so a native
  // key-repeat keydown -- or a device that just resends discrete keydowns
  // while held -- doesn't restart the press from scratch.
  const heldSeekDirection = useRef<'forward' | 'backward' | null>(null);
  const seekHoldTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekHoldInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const seekPreviewHideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Shared by the MediaPlayPause and Space key handlers below.
    function toggleActiveVideo() {
      const container = containerRef.current;
      const activeSection = container?.querySelector<HTMLElement>(
          `[data-index="${activeIndex}"]`,
      );
      const video = activeSection?.querySelector('video');
      if (video) {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      }
    }

    // Seeks the active video by `deltaSeconds` (negative = backward),
    // clamped to the media's own bounds. Returns false (and does nothing)
    // when there's no active video with a known, finite duration -- e.g.
    // a photo, or a live/indefinite HLS stream -- so callers know not to
    // bother showing seek feedback for a press that had no effect.
    function applySeek(deltaSeconds: number): boolean {
      const container = containerRef.current;
      const activeSection = container?.querySelector<HTMLElement>(
          `[data-index="${activeIndex}"]`,
      );
      const video = activeSection?.querySelector('video');
      if (!video || !video.duration || !Number.isFinite(video.duration)) return false;
      video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + deltaSeconds));
      return true;
    }

    // Clears any pending hold timers/interval and marks nothing as held.
    // Used both on a normal key release and to tidy up if this effect gets
    // torn down (dependency change or unmount) mid-hold.
    function stopSeekHold() {
      heldSeekDirection.current = null;
      if (seekHoldTimeout.current !== null) {
        clearTimeout(seekHoldTimeout.current);
        seekHoldTimeout.current = null;
      }
      if (seekHoldInterval.current !== null) {
        clearInterval(seekHoldInterval.current);
        seekHoldInterval.current = null;
      }
    }

    function handleSeekPress(direction: 'forward' | 'backward') {
      // Native key-repeat (or a remote that just resends the keydown while
      // held) would otherwise restart the press and double up on the
      // initial step -- ignore it, our own interval below handles repeats.
      if (heldSeekDirection.current === direction) return;

      const step = direction === 'forward' ? FAST_FORWARD_STEP_SECONDS : REWIND_STEP_SECONDS;
      const delta = direction === 'forward' ? step : -step;

      // A fresh press cancels any lingering fade-out from a previous tap
      // so the indicator can keep accumulating instead of resetting to 0.
      if (seekPreviewHideTimeout.current !== null) {
        clearTimeout(seekPreviewHideTimeout.current);
        seekPreviewHideTimeout.current = null;
      }

      if (!applySeek(delta)) return; // nothing to seek (photo, live stream, ...)

      heldSeekDirection.current = direction;
      setSeekPreview((prev) =>
          prev && prev.direction === direction
              ? { direction, totalSeconds: prev.totalSeconds + step }
              : { direction, totalSeconds: step },
      );

      // Past the hold delay, keep applying the same step on an interval
      // for as long as the key stays down -- this is the "stacking".
      seekHoldTimeout.current = setTimeout(() => {
        seekHoldInterval.current = setInterval(() => {
          if (!applySeek(delta)) return;
          setSeekPreview((prev) =>
              prev && prev.direction === direction
                  ? { direction, totalSeconds: prev.totalSeconds + step }
                  : { direction, totalSeconds: step },
          );
        }, SEEK_REPEAT_INTERVAL_MS);
      }, SEEK_HOLD_DELAY_MS);
    }

    function handleSeekRelease(direction: 'forward' | 'backward') {
      if (heldSeekDirection.current !== direction) return;
      stopSeekHold();
      // Let the indicator linger briefly so a quick single tap is still
      // visible, then fade it out and reset the accumulated total.
      seekPreviewHideTimeout.current = setTimeout(() => {
        setSeekPreview(null);
        seekPreviewHideTimeout.current = null;
      }, SEEK_PREVIEW_LINGER_MS);
    }

    function onKeyDown(e: KeyboardEvent) {
      // The sidebar's own spatial-navigation hook drives arrow keys while
      // it's open (including closing itself on ArrowLeft at its left
      // edge), so back off entirely rather than double-handling them.
      if (sidebarOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (activeIndex < itemCount - 1) scrollToIndex(activeIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (activeIndex > 0) scrollToIndex(activeIndex - 1);
          break;
        case 'ArrowRight':
          if (isGalleryActive && galleryIndex < galleryLength - 1) {
            e.preventDefault();
            onGalleryChange(galleryIndex + 1);
          } else {
            // No more gallery slides to the right (or no gallery at all) --
            // this counts as the "right edge" of the feed, so open the
            // sidebar instead.
            e.preventDefault();
            onOpenSidebar();
          }
          break;
        case 'ArrowLeft':
          if (isGalleryActive && galleryIndex > 0) {
            e.preventDefault();
            onGalleryChange(galleryIndex - 1);
          }
          break;
        case 'MediaFastForward':
          e.preventDefault();
          handleSeekPress('forward');
          break;
        case 'MediaRewind':
          e.preventDefault();
          handleSeekPress('backward');
          break;
        case 'MediaPlayPause': {
          // Both the plain <video> path and HlsPlayer render a single
          // <video> element under the active section's [data-index] node,
          // so a scoped query finds "the" video regardless of which kind
          // it is -- no need to thread refs up from MediaSlot/HlsPlayer.
          e.preventDefault();
          toggleActiveVideo();
          break;
        }
        case ' ': {
          // Same play/pause toggle as MediaPlayPause, bound to Space since
          // that's the play/pause key on most remotes/keyboards without a
          // dedicated media key. Guarded like Enter below -- if a real
          // focusable control has focus, Space should activate it normally
          // (e.g. a button) instead of being hijacked here.
          const targetTag = (e.target as HTMLElement | null)?.tagName;
          if (targetTag === 'BUTTON' || targetTag === 'INPUT' || targetTag === 'A') break;
          e.preventDefault();
          toggleActiveVideo();
          break;
        }
        case 'Enter': {
          // Guard against hijacking a real focused control -- if something
          // like a card's subreddit/flair/username button (or any other
          // focusable element) happens to have focus, Enter should activate
          // it normally rather than toggling the chrome out from under it.
          const targetTag = (e.target as HTMLElement | null)?.tagName;
          if (targetTag === 'BUTTON' || targetTag === 'INPUT' || targetTag === 'A') break;
          e.preventDefault();
          onToggleChrome();
          break;
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'MediaFastForward') handleSeekRelease('forward');
      else if (e.key === 'MediaRewind') handleSeekRelease('backward');
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      // If this effect is torn down mid-hold (e.g. the sidebar opens, or
      // activeIndex/other deps change), don't leave the interval running
      // against a stale closure -- stop immediately and drop the preview
      // rather than letting it fade out on its own schedule.
      stopSeekHold();
      if (seekPreviewHideTimeout.current !== null) {
        clearTimeout(seekPreviewHideTimeout.current);
        seekPreviewHideTimeout.current = null;
      }
      setSeekPreview(null);
    };
  }, [
    activeIndex,
    itemCount,
    scrollToIndex,
    isGalleryActive,
    galleryIndex,
    galleryLength,
    onGalleryChange,
    sidebarOpen,
    onOpenSidebar,
    onToggleChrome,
  ]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
    }

    function onTouchEnd(e: TouchEvent) {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start || !isGalleryActive) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      // Only treat as a gallery swipe if it's clearly more horizontal than
      // vertical, so vertical feed swipes (handled by native scroll) aren't
      // hijacked.
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && galleryIndex < galleryLength - 1) onGalleryChange(galleryIndex + 1);
        else if (dx > 0 && galleryIndex > 0) onGalleryChange(galleryIndex - 1);
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, isGalleryActive, galleryIndex, galleryLength, onGalleryChange]);

  return { seekPreview };
}