import type { Haptics } from "@openchat/ui/src/native/haptics";
import { haptic } from "tauri-plugin-oc-api";

/**
 * The haptics the native root installs in the kit (`setHaptics`): the device's light tap in the
 * apps, through the Tauri plugin, and none on mobile web (#10366), where the kit would otherwise
 * vibrate. A shell older than the plugin's command has none either: its rejection is dropped.
 */
export function hostHaptics(nativeApp: boolean): Haptics {
    if (!nativeApp) return () => {};
    return () => {
        haptic().catch(() => {
            // an older shell, or haptics turned off: no haptics is never an error
        });
    };
}
