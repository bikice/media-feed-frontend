import { useEffect } from 'react';
import type { RefObject } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

const FOCUSABLE_SELECTOR =
    'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

const KEY_TO_DIRECTION: Record<string, Direction> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
};

function xCenter(el: HTMLElement): number {
    const rect = el.getBoundingClientRect();
    return rect.left + rect.width / 2;
}

/**
 * Groups a container's focusable elements into visual "rows", in document
 * order. An element wrapped in the nearest `[data-tv-row]` ancestor shares
 * a row with its siblings under that same ancestor (e.g. a horizontal
 * group of chip buttons); anything else stands alone as its own single-item
 * row (e.g. the search input, a lone clear button) -- which is exactly the
 * "full size row" behavior those elements should get for free, with no
 * markup required.
 */
function buildRows(container: HTMLElement): HTMLElement[][] {
    const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const rows: HTMLElement[][] = [];
    const rowIndexByGroup = new Map<HTMLElement, number>();

    for (const el of all) {
        const group = el.closest<HTMLElement>('[data-tv-row]');
        if (group && container.contains(group)) {
            let idx = rowIndexByGroup.get(group);
            if (idx === undefined) {
                idx = rows.length;
                rows.push([]);
                rowIndexByGroup.set(group, idx);
            }
            rows[idx].push(el);
        } else {
            rows.push([el]);
        }
    }
    return rows;
}

function locate(rows: HTMLElement[][], el: HTMLElement): { rowIndex: number; colIndex: number } | null {
    for (let r = 0; r < rows.length; r++) {
        const c = rows[r].indexOf(el);
        if (c !== -1) return { rowIndex: r, colIndex: c };
    }
    return null;
}

interface UseSpatialNavigationOptions {
    /** Only wire up / focus-manage while true (e.g. the sidebar is open). */
    active: boolean;
    /** Called when a D-pad press has no row/element to move to in that
     *  direction -- i.e. focus is already at that edge of the container
     *  (e.g. the leftmost column, or the last row). Return true if you
     *  handled it (e.g. closed the panel), which suppresses the key event;
     *  return false/undefined to let it fall through untouched. */
    onEdge?: (direction: Direction, current: HTMLElement) => boolean | void;
}

/**
 * D-pad/arrow-key navigation within a container, for Fire TV remotes and
 * similar. Focusable elements are grouped into rows (see `buildRows`):
 *
 *  - Left/Right move between elements within the current row, in DOM order.
 *  - Up/Down move to the adjacent row. A single-item row (search input, a
 *    lone clear button, ...) is always selected in full, regardless of
 *    where horizontally the user was coming from. A multi-item row (a
 *    group of chip buttons marked with `data-tv-row`) picks whichever of
 *    its elements sits closest, left-to-right, to where the user was --
 *    so leaving a wrapped button group and coming back lands near where
 *    you left off.
 *
 * When a direction has no row/element to move to, `onEdge` is invoked
 * instead, which is how e.g. "press left at the sidebar's left edge" gets
 * turned into "close it".
 */
export function useSpatialNavigation(
    containerRef: RefObject<HTMLElement | null>,
    options: UseSpatialNavigationOptions,
) {
    const { active, onEdge } = options;

    useEffect(() => {
        if (!active) return;
        const containerEl = containerRef.current;
        if (!containerEl) return;
        // TS doesn't retain null-narrowing for a captured variable across a
        // nested function declaration, even though it's a const -- rebind to
        // a plain HTMLElement so onKeyDown below doesn't need re-checking.
        const container: HTMLElement = containerEl;

        const getFocusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

        // Land focus somewhere sensible the moment this zone becomes active,
        // unless focus is already inside it (e.g. re-render while open).
        if (!container.contains(document.activeElement)) {
            getFocusable()[0]?.focus();
        }

        function onKeyDown(e: KeyboardEvent) {
            const direction = KEY_TO_DIRECTION[e.key];
            if (!direction) return;

            const current = document.activeElement as HTMLElement | null;
            if (!current || !container.contains(current)) return;

            // Let left/right move the text cursor normally inside an input;
            // only up/down bounce focus out of it into the rest of the panel.
            if (current.tagName === 'INPUT' && (direction === 'left' || direction === 'right')) return;

            const rows = buildRows(container);
            const pos = locate(rows, current);
            if (!pos) return;
            const { rowIndex, colIndex } = pos;

            if (direction === 'left' || direction === 'right') {
                const nextCol = direction === 'right' ? colIndex + 1 : colIndex - 1;
                const target = rows[rowIndex][nextCol];
                if (target) {
                    e.preventDefault();
                    target.focus();
                    return;
                }
                if (onEdge?.(direction, current)) e.preventDefault();
                return;
            }

            // up/down: move to the adjacent row.
            const targetRow = rows[direction === 'down' ? rowIndex + 1 : rowIndex - 1];
            if (!targetRow || targetRow.length === 0) {
                if (onEdge?.(direction, current)) e.preventDefault();
                return;
            }
            e.preventDefault();
            if (targetRow.length === 1) {
                targetRow[0].focus();
                return;
            }
            const currentX = xCenter(current);
            let best = targetRow[0];
            let bestDist = Infinity;
            for (const el of targetRow) {
                const dist = Math.abs(xCenter(el) - currentX);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = el;
                }
            }
            best.focus();
        }

        // A focused element can vanish out from under the user -- e.g.
        // selecting a suggestion removes the suggestions list, including
        // whichever suggestion button was focused. The browser then drops
        // focus to <body>, which is outside `container`, so onKeyDown above
        // would start silently ignoring every key press. Watch for focus
        // leaving the container while this zone is still active and pull it
        // back in once the DOM settles, rather than leaving navigation dead.
        function onFocusOut() {
            requestAnimationFrame(() => {
                if (!container.isConnected) return;
                if (!container.contains(document.activeElement)) {
                    getFocusable()[0]?.focus();
                }
            });
        }

        container.addEventListener('keydown', onKeyDown);
        container.addEventListener('focusout', onFocusOut);
        return () => {
            container.removeEventListener('keydown', onKeyDown);
            container.removeEventListener('focusout', onFocusOut);
        };
    }, [active, containerRef, onEdge]);
}