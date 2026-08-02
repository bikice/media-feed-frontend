import { useState } from 'react';
import { useKeyEventLog } from '@/hooks/useKeyEventLog';

/**
 * On-screen log of every keydown the app receives, for checking what a
 * Fire TV remote (or any keyboard) actually sends -- e.g. confirming the
 * Back button's real `key`/`code` before wiring it up. Toggled on via the
 * `?debug` URL param; see `lib/debug.ts`.
 */
export function DebugKeyOverlay() {
    const log = useKeyEventLog(true);
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="glass fixed bottom-4 left-4 z-50 w-80 max-w-[90vw] rounded-xl border border-(--color-border) p-3 font-(family-name:--font-mono) text-[11px]">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-(--color-text)">Key events</span>
                <button
                    onClick={() => setCollapsed((v) => !v)}
                    className="rounded-md px-2 py-0.5 text-(--color-text-dim) hover:bg-white/8 hover:text-(--color-text)"
                >
                    {collapsed ? 'show' : 'hide'}
                </button>
            </div>

            {!collapsed && (
                <>
                    {log.length === 0 && <p className="text-(--color-text-dim)">Waiting for input…</p>}
                    <ul className="scrollbar-visible max-h-64 space-y-1 overflow-y-auto">
                        {log.map((e) => (
                            <li key={e.id} className="rounded-lg border border-(--color-border) p-1.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-semibold text-(--color-text)">{e.key}</span>
                                    <span
                                        className={
                                            e.defaultPrevented
                                                ? 'shrink-0 text-(--color-pink)'
                                                : 'shrink-0 text-(--color-text-dim)'
                                        }
                                    >
                                        {e.defaultPrevented ? 'handled' : 'passthrough'}
                                    </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between gap-2 text-(--color-text-dim)">
                                    <span className="truncate">{e.code}</span>
                                    <span className="truncate">{e.target}</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}