import type { OpenChat } from "@client";
import { invoke } from "@tauri-apps/api/core";

/**
 * Clears this device's cached data, then starts afresh from the backend: the native app restarts,
 * a browser reloads. Every tree's "clear cache".
 */
export async function clearCacheAndRestart(
    client: Pick<OpenChat, "clearCachedData" | "isNativeApp">,
): Promise<void> {
    await client.clearCachedData();
    if (client.isNativeApp()) {
        await invoke("plugin:oc|restart_app");
    } else {
        window.location.reload();
    }
}
