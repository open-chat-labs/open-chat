import { invoke } from "@tauri-apps/api/core";

/**
 * The Android status and navigation bars' icons: dark (`darkIcons`) over a light theme, light over
 * a dark one. Rejects on a shell older than the command, or on iOS.
 */
export async function setSystemBarsStyle(darkIcons: boolean): Promise<void> {
    return await invoke<void>("plugin:oc|set_system_bars_style", { darkIcons });
}
