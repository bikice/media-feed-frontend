import { useEffect, useRef, useState } from 'react';

export interface LoggedKeyEvent {
    id: number;
    key: string;
    code: string;
    target: string;
    defaultPrevented: boolean;
    timestamp: number;
}

const MAX_LOG_ENTRIES = 40;

/**
 * Captures every keydown reaching the app and keeps a rolling log for the
 * debug overlay. Registered on `window` with `capture: true`, so it sees
 * events during the capturing phase -- before they reach the target and
 * before any of the app's own bubble-phase listeners (useFeedNavigation,
 * useSpatialNavigation, ...) run. That means it logs literally everything
 * the remote sends, not just what our handlers happen to recognize, which
 * is the whole point: finding out what an *unmapped* button sends.
 *
 * Only active while `enabled` is true, so it costs nothing when the
 * `?debug` URL flag isn't set.
 */
export function useKeyEventLog(enabled: boolean): LoggedKeyEvent[] {
    const [log, setLog] = useState<LoggedKeyEvent[]>([]);
    const idRef = useRef(0);

    useEffect(() => {
        if (!enabled) return;

        function describeTarget(target: EventTarget | null): string {
            if (!(target instanceof HTMLElement)) return 'unknown';
            const label = target.getAttribute('aria-label');
            return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${label ? ` [${label}]` : ''}`;
        }

        function onKeyDown(e: KeyboardEvent) {
            const key = e.key;
            const code = e.code;
            const target = describeTarget(e.target);

            // Read defaultPrevented after this tick: we're in the capture
            // phase (first to see the event), so the app's own bubble-phase
            // handlers haven't run yet. Give them a turn so the overlay
            // reflects whether something actually handled the key, not just
            // that it arrived.
            setTimeout(() => {
                setLog((prev) => {
                    const entry: LoggedKeyEvent = {
                        id: idRef.current++,
                        key,
                        code,
                        target,
                        defaultPrevented: e.defaultPrevented,
                        timestamp: Date.now(),
                    };
                    const next = [entry, ...prev];
                    return next.length > MAX_LOG_ENTRIES ? next.slice(0, MAX_LOG_ENTRIES) : next;
                });
            }, 0);
        }

        window.addEventListener('keydown', onKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    }, [enabled]);

    return log;
}