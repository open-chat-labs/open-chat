import {
    createChannel,
    Importance,
    Visibility,
    channels,
    isPermissionGranted,
    requestPermission,
} from "@tauri-apps/plugin-notification";
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

    // Create a channel for receiving notifications!
    // NOTE: We are currently doing this natively, in Kotlin code, but keeping
    // this here for future reference in case we want to do it via Tauri.
    // createNotificationChannel();

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

// @ts-ignore
async function createNotificationChannel() {
    try {
        const channelExists = await checkMessagesNotificationChannelExists();
        if (channelExists) {
            console.log("Notification channel 'messages' already exists.");
            return;
        }

        await createChannel({
            id: "messages",
            name: "Messages",
            description: "Notifications for new messages",
            importance: Importance.High,
            visibility: Visibility.Private,
            lights: true,
            lightColor: "#8D2380",
            vibration: true,
            sound: "notification_sound",
        });
    } catch (error) {
        console.error("Failed to create notification channel:", error);
    }
}

// We can check if the channel exists by listing all channels and checking for
// the one we want. While this is not strictly necessary, it may be useful for
// debugging purposes or if we want to ensure the channel is created only once
// - which should be the case even with multiple createChannel calls, if channel
// exists it is not created again.
// @ts-ignore
async function checkMessagesNotificationChannelExists() {
    try {
        const existingChannels = await channels();
        return existingChannels.some((channel) => channel.id === "messages");
    } catch (error) {
        console.error("Failed to check notification channels:", error);
        return false;
    }
}
