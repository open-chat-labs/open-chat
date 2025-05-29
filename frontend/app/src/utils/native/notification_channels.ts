import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { addPluginListener, PluginListener } from "@tauri-apps/api/core";

const TAURI_PLUGIN_NAME = "oc";
const PUSH_NOTIFICATION_EVENT = "push-notification";

/**
 * Sets up a listener for push notifications. This function will ask for
 * permission to show notifications!
 * 
 * Can be tested within App.svelte onMount:
 * ```ts
 * import { expectPushNotifications } from "@utils/native/notification_channels";
 * 
 * if (client.isNativeApp()) {
 *   // Listen for incoming push notifications
 *   expectPushNotifications((notification) => {
 *       console.log("Notification data: ", notification);
 *   }).catch((error) => {
        console.error("Failed to set up push notifications", error);
 *   });
 * }
 * ```
 *
 * @param handler - The function to call when a push notification is received.
 * @returns A promise that resolves to a PluginListener for the push, and
 * provides the unlisten method.
 */
export async function expectPushNotifications<T>(
    handler: (data: T) => void,
): Promise<PluginListener> {
    // Make sure we have permission to receive notifications!
    const canReceiveNotifications = await askForPermission();

    if (!canReceiveNotifications) {
        return Promise.reject(new Error("Notification permission not granted"));
    }

    // Set up the listener for push notifications!
    return addPluginListener(TAURI_PLUGIN_NAME, PUSH_NOTIFICATION_EVENT, handler);
}

async function askForPermission(): Promise<boolean> {
    try {
        // Do you have permission to send a notification?
        let permissionGranted = await isPermissionGranted();

        // If not we need to request it
        if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === "granted";
        }

        return permissionGranted;
    } catch (error) {
        console.error("Failed to ask for notification permission:", error);
    }

    return false;
}
