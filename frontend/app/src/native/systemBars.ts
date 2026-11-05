import type { PluginListener } from "@tauri-apps/api/core";
import {
    setStatusAndNavBarSizesForNativeApp,
    updateAndroidInterfaceSizes,
} from "@stores/androidInterfaceSizes";
import { expectWindowInsetChange } from "@utils/native/notification_channels";

// The safe areas in the Android app. Its edge-to-edge WebView doesn't report
// env(safe-area-inset-*) reliably, so the shell reports the status and navigation bars' heights
// itself (the window-inset event), which the app keeps in androidInterfaceSizes and writes to
// --device-status-bar-height / --device-nav-height on <html>, as components_mobile does. The native
// tree's --safe-top / --safe-bottom take the larger of the two readings.

export const ANDROID_SAFE_TOP =
    "max(env(safe-area-inset-top, 0px), var(--device-status-bar-height, 0px))";
export const ANDROID_SAFE_BOTTOM =
    "max(env(safe-area-inset-bottom, 0px), var(--device-nav-height, 0px))";

/** Follows the Android app's system bars into the safe areas on `root`. Returns the teardown. */
export function followAndroidSystemBars(root: HTMLElement): () => void {
    // the last sizes reported, in case the WebView was reloaded without an inset change
    setStatusAndNavBarSizesForNativeApp();
    root.style.setProperty("--safe-top", ANDROID_SAFE_TOP);
    root.style.setProperty("--safe-bottom", ANDROID_SAFE_BOTTOM);

    let listener: PluginListener | undefined;
    let following = true;
    void listen();

    return () => {
        following = false;
        void listener?.unregister();
        root.style.removeProperty("--safe-top");
        root.style.removeProperty("--safe-bottom");
    };

    async function listen() {
        try {
            const registered = await expectWindowInsetChange((data) =>
                updateAndroidInterfaceSizes(data.statusBarHeightDp, data.navHeightDp),
            );
            if (following) listener = registered;
            else void registered.unregister();
        } catch (err) {
            console.error("Couldn't follow the system bars", err);
        }
    }
}
