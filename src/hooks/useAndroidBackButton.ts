import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Wires the Android hardware back button to in-app navigation instead of
 * letting it fall through to Capacitor's default "exit the app" behavior.
 *
 * Order of handling, on each hardware back press:
 *  1. `onIntercept` gets first say -- return `true` to consume the press
 *     (e.g. close an open sidebar/overlay). This is how transient UI is
 *     dismissed before we start stepping back through history.
 *  2. Otherwise, if there is app history to unwind (`canGoBack`, reported by
 *     the platform), step back one entry via `window.history.back()`. That
 *     replays the feed's provider/source/flair/order/search history that
 *     useFeedUrlState pushes, so back returns to the previous selection
 *     rather than closing the app.
 *  3. Only when there's nothing left to go back to do we actually exit.
 *
 * No-op on the web (the plugin only emits on native Android), so it's safe
 * to mount unconditionally.
 */
export function useAndroidBackButton(onIntercept?: () => boolean) {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const handle = App.addListener('backButton', ({ canGoBack }) => {
            if (onIntercept?.()) return;
            if (canGoBack) {
                window.history.back();
            } else {
                App.exitApp();
            }
        });

        return () => {
            handle.then((h) => h.remove());
        };
    }, [onIntercept]);
}
