import { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/date';

interface VideoTimeDisplayProps {
    video: HTMLVideoElement | null;
}

export function VideoTimeDisplay({ video }: VideoTimeDisplayProps) {
    const [currentTime, setCurrentTime] = useState<number | null>(null);
    const [duration, setDuration] = useState<number | null>(null);

    useEffect(() => {
        setCurrentTime(null);
        setDuration(null);
        if (!video) return;

        function updateTime() {
            if (!video || video.readyState < 1) {
                setCurrentTime(null);
                setDuration(null);
                return;
            }

            setCurrentTime(Number.isFinite(video.currentTime) && video.currentTime >= 0 ? video.currentTime : null);
            setDuration(Number.isFinite(video.duration) && video.duration >= 0 ? video.duration : null);
        }

        video.addEventListener('timeupdate', updateTime);
        video.addEventListener('loadedmetadata', updateTime);
        video.addEventListener('durationchange', updateTime);
        video.addEventListener('seeked', updateTime);
        video.addEventListener('emptied', updateTime);
        updateTime();

        return () => {
            video.removeEventListener('timeupdate', updateTime);
            video.removeEventListener('loadedmetadata', updateTime);
            video.removeEventListener('durationchange', updateTime);
            video.removeEventListener('seeked', updateTime);
            video.removeEventListener('emptied', updateTime);
        };
    }, [video]);

    const formattedCurrentTime = currentTime === null ? null : formatDuration(currentTime);
    if (!formattedCurrentTime) return null;

    const formattedDuration = duration === null ? null : formatDuration(duration);

    return (
        <span className="glass shrink-0 rounded-full px-2 py-1 text-xs text-(--color-text-dim)">
            {formattedCurrentTime}{formattedDuration ? ` / ${formattedDuration}` : ''}
        </span>
    );
}