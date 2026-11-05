import { invoke } from "@tauri-apps/api/core";

/**
 * A light haptic tap (Android's keyboard tap feedback, iOS's light impact). Rejects on a shell
 * older than the command, which the caller treats as no haptics.
 */
export async function haptic(): Promise<void> {
    return await invoke<void>("plugin:oc|haptic");
}
