import { FastForward, Rewind } from 'lucide-react';
import type { SeekPreview } from '@/hooks/useFeedNavigation';

interface VideoSeekIndicatorProps {
    seek: SeekPreview;
}

/**
 * Transient side-of-screen indicator shown while MediaFastForward/
 * MediaRewind is being pressed or held (see useFeedNavigation). Sits on
 * the same side as the direction it represents -- right for forward, left
 * for rewind -- mirroring the long-press seek indicator pattern from
 * Netflix/YouTube-style TV apps.
 */
export function VideoSeekIndicator({ seek }: VideoSeekIndicatorProps) {
    const isForward = seek.direction === 'forward';
    const Icon = isForward ? FastForward : Rewind;

    return (
        <div
            className={`pointer-events-none absolute inset-y-0 z-20 flex w-1/3 items-center ${
                isForward ? 'right-0 justify-end pr-6' : 'left-0 justify-start pl-6'
            }`}
        >
            <div className="glass flex flex-col items-center gap-1.5 rounded-2xl px-5 py-4">
                <Icon className="h-7 w-7 text-(--color-text)" />
                <span className="font-(family-name:--font-mono) text-sm font-semibold text-(--color-text)">
                    {isForward ? '+' : '-'}
                    {seek.totalSeconds}s
                </span>
            </div>
        </div>
    );
}