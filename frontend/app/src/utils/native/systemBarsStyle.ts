import { currentThemeMode } from "@theme/themes";
import { setSystemBarsStyle } from "tauri-plugin-oc-api";

let following = false;
let lightTheme = false;
let darkScreen = false;

function apply() {
    // dark icons over the light theme, unless a dark screen is up
    setSystemBarsStyle(lightTheme && !darkScreen).catch((err) =>
        console.warn("Couldn't set the system bars' style", err),
    );
}

/** A dark screen is up over the app (the native tree's call screen): light icons whatever the theme. */
export function setDarkScreenUp(up: boolean) {
    if (darkScreen === up) return;
    darkScreen = up;
    if (following) apply();
}

/**
 * The Android status and navigation bars' icons follow the app's theme (dark icons over a light
 * one), which can differ from the system's, all the activity goes by; light while a dark screen
 * is up (`setDarkScreenUp`). Returns the teardown.
 */
export function followThemeInSystemBars(): () => void {
    following = true;
    const unsubscribe = currentThemeMode.subscribe((mode) => {
        lightTheme = mode === "light";
        apply();
    });
    return () => {
        following = false;
        unsubscribe();
    };
}
