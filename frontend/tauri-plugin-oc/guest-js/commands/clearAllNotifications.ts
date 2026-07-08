import { invoke } from "@tauri-apps/api/core";

/**
 * Clears every displayed notification (per-chat + summary) and releases the
 * native notification store. Call on sign-out so nothing belonging to the
 * previous account lingers in the tray.
 */
export async function clearAllNotifications(): Promise<void> {
    await invoke("plugin:oc|clear_all_notifications");
}
