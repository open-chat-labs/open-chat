import { currentThemeMode } from "@theme/themes";
import { setSystemBarsStyle } from "tauri-plugin-oc-api";

/**
 * The Android status and navigation bars' icons follow the app's theme (dark icons over a light
 * one), which can differ from the system's, all the activity goes by. Returns the teardown.
 */
export function followThemeInSystemBars(): () => void {
    return currentThemeMode.subscribe((mode) => {
        setSystemBarsStyle(mode === "light").catch((err) =>
            console.warn("Couldn't set the system bars' style", err),
        );
    });
}
