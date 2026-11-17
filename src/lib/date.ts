export function formatTimestamp(unixSeconds: number | null | undefined): string | null {
    if (typeof unixSeconds !== 'number' || !Number.isFinite(unixSeconds) || unixSeconds === 0) return null;

    const date = new Date(unixSeconds * 1000);
    if (!Number.isFinite(date.getTime())) return null;

    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatDuration(seconds: number): string | null {
    if (!Number.isFinite(seconds) || seconds < 0) return null;

    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}