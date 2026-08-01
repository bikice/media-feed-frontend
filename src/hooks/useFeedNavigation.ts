import { useEffect, useRef } from 'react';
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
}

const SWIPE_THRESHOLD_PX = 50;

/**
 * Wires up:
 *  - ArrowUp/ArrowDown -> move one item up/down in the main vertical feed
 *  - ArrowLeft/ArrowRight -> page through the active item's gallery (if any)
 *  - Horizontal touch swipe on the active card -> same gallery paging
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
                                  }: UseFeedNavigationOptions) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
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
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
}