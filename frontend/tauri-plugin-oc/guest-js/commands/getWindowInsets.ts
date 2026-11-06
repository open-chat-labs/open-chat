import { invoke } from "@tauri-apps/api/core";

/** The window insets as the Android app last reported them (the window-inset-change event's payload). */
export type WindowInsets = {
    isKeyboardOpen: boolean;
    isGestureNavigation: boolean;
    navHeightDp: number;
    statusBarHeightDp: number;
    keyboardHeightDp: number;
    apiLevel: number;
    osVersion: string;
};

/**
 * The window insets as last reported (Android), for a listener that starts after they were sent;
 * undefined before the app has reported any. Rejects on a shell older than the command.
 */
export async function getWindowInsets(): Promise<WindowInsets | undefined> {
    const insets = await invoke<Partial<WindowInsets>>("plugin:oc|get_window_insets");
    return isWindowInsets(insets) ? insets : undefined;
}

function isWindowInsets(insets: Partial<WindowInsets>): insets is WindowInsets {
    return typeof insets.statusBarHeightDp === "number" && typeof insets.navHeightDp === "number";
}
