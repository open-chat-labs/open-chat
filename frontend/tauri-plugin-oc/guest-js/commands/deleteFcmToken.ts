import { invoke } from "@tauri-apps/api/core";

/**
 * Deletes the device's FCM token and clears the native cache. Call on
 * sign-out: pushes aimed at the deleted token dead-end at FCM even if the
 * server-side removal failed. Firebase mints a fresh token on the next
 * getFcmToken() call, so the next login re-registers cleanly.
 */
export async function deleteFcmToken(): Promise<void> {
    await invoke("plugin:oc|delete_fcm_token");
}
