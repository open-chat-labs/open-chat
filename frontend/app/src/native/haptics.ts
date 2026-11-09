import type { Haptics } from "@openchat/ui/src/native/haptics";
import { haptic } from "tauri-plugin-oc-api";

/**
 * The haptics the native root installs in the kit (`setHaptics`): the device's haptic in the apps,
 * through the Tauri plugin (light: a tap; medium: Android's long-press feedback, iOS's medium
 * impact), and none on mobile web (#10366), where the kit would otherwise vibrate. A shell that
 * takes no style plays its light tap; one older than the plugin's command has none: its rejection
 * is dropped.
 */
export function hostHaptics(nativeApp: boolean): Haptics {
    if (!nativeApp) return () => {};
    return (style) => {
        haptic(style).catch(() => {
            // an older shell, or haptics turned off: no haptics is never an error
        });
    };
}
