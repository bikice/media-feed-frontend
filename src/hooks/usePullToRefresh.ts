import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

interface UsePullToRefreshOptions {
  /** Scrollable feed container the gesture is measured against. */
  containerRef: RefObject<HTMLElement | null>;
  /** Invoked once when a pull past the threshold is released. */
  onRefresh: () => void;
  /** When true, the gesture is ignored (e.g. sidebar open, already loading). */
  disabled?: boolean;
}

interface UsePullToRefreshResult {
  /** Current downward pull distance in px (0 when not pulling). Damped so it
   *  eases off the further you drag, matching the usual native feel. */
  pullDistance: number;
  /** True once the pull has passed the trigger threshold, so the caller can
   *  flip the indicator to a "release to refresh" state. */
  armed: boolean;
}

// How far (in damped px) the user must pull before a release triggers a
// refresh, and the cap on how far the indicator visually travels.
const PULL_TRIGGER_PX = 70;
const PULL_MAX_PX = 110;
// Resistance applied to the raw finger travel so the indicator eases off the
// further you drag rather than tracking the finger 1:1.
const PULL_RESISTANCE = 0.5;

/**
 * Touch pull-to-refresh for a vertically scrolling container. Only engages
 * when the container is already scrolled to the very top and the gesture is
 * a downward drag, so it never fights native scroll/scroll-snap mid-feed.
 */
export function usePullToRefresh({
  containerRef,
  onRefresh,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [armed, setArmed] = useState(false);

  // Y position where a top-edge pull started, or null when not tracking one.
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    function onTouchStart(e: TouchEvent) {
      // Only arm a pull if we're already at the top; otherwise this is a
      // normal scroll and we stay out of the way.
      if (el!.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
      } else {
        startY.current = null;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      // Upward (or non-)movement isn't a pull -- reset and let native scroll
      // take over.
      if (dy <= 0) {
        if (pullDistance !== 0) setPullDistance(0);
        if (armed) setArmed(false);
        return;
      }
      // If the container scrolled away from the top mid-gesture, abandon.
      if (el!.scrollTop > 0) {
        startY.current = null;
        setPullDistance(0);
        setArmed(false);
        return;
      }
      const damped = Math.min(PULL_MAX_PX, dy * PULL_RESISTANCE);
      setPullDistance(damped);
      setArmed(damped >= PULL_TRIGGER_PX);
    }

    function onTouchEnd() {
      if (startY.current === null) return;
      const shouldRefresh = pullDistance >= PULL_TRIGGER_PX;
      startY.current = null;
      setPullDistance(0);
      setArmed(false);
      if (shouldRefresh) onRefresh();
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef, onRefresh, disabled, pullDistance, armed]);

  return { pullDistance, armed };
}
