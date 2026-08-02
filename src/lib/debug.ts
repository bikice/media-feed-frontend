/**
 * Enables the on-screen key-event debug overlay via a `?debug` URL param,
 * e.g. `?debug=1` or `?debug=keys`. Handy for checking exactly what
 * `key`/`code` a Fire TV remote button actually sends -- Back, media
 * transport keys, etc. -- without needing to attach devtools to the TV's
 * WebView.
 */
export function isDebugEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const value = new URLSearchParams(window.location.search).get('debug');
    return value !== null && value !== '0' && value !== 'false';
}