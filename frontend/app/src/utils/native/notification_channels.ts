import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { addPluginListener, PluginListener } from "@tauri-apps/api/core";
import { showNotification } from "tauri-plugin-oc-api";
import page from "page";

const TAURI_PLUGIN_NAME = "oc";
const PUSH_NOTIFICATION_EVENT = "push-notification";
const NEW_FCM_TOKEN_EVENT = "fcm-token";
const NOTIFICATION_TAP_EVENT = "notification-tap";
const BACK_PRESS_EVENT = "back-pressed";

type PushNotification = {
    id: number;
    type: "DM" | "GROUP" | "CHANNEL";
    senderId?: string;
    groupId?: string;
    communityId?: string;
    channelId?: number;
    threadIndex?: number;
};

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
 *   expectPushNotifications().catch((error) => {
        console.error("Failed to set up push notifications", error);
 *   });
 * }
 * ```
 *
 * @param handler - The function to call when a push notification is received.
 * @returns A promise that resolves to a PluginListener for the push, and
 * provides the unlisten method.
 * 
 * TODO handle favourite paths
 */
export async function expectPushNotifications(): Promise<PluginListener> {
    // Make sure we have permission to receive notifications!
    const canReceiveNotifications = await askForPermission();

    if (!canReceiveNotifications) {
        return Promise.reject(new Error("Notification permission not granted"));
    }

    // Set up the listener for push notifications!
    return addPluginListener(
        TAURI_PLUGIN_NAME,
        PUSH_NOTIFICATION_EVENT,
        (notification: PushNotification) => {
            const pathname = window.location.pathname;
            switch (notification.type) {
                case "DM": {
                    // TODO handle threads, eventually, once supported by dm's
                    const expectedPath = `/user/${notification.senderId}`;
                    if (!pathname.startsWith(expectedPath)) {
                        // We're not in the context of the user's chat, send
                        // notification back to native code to be displayed!
                        showNotification({ notificationId: notification.id });
                    }
                    break;
                }
                case "GROUP": {
                    const expectedPath = `/group/${notification.groupId}`;
                    const inThreadContext =
                        notification.threadIndex !== undefined &&
                        pathname.startsWith(`${expectedPath}/${notification.threadIndex}`);
                    const inGroupContext = pathname.startsWith(expectedPath);

                    // We're not in the context of the group or thread, send
                    // notification back to native code to be displayed!
                    if (!(inGroupContext || inThreadContext)) {
                        showNotification({ notificationId: notification.id });
                    }
                    break;
                }
                case "CHANNEL": {
                    const expectedPath = `/community/${notification.communityId}/channel/${notification.channelId}`;
                    const inThreadContext =
                        notification.threadIndex !== undefined &&
                        pathname.startsWith(`${expectedPath}/${notification.threadIndex}`);
                    const inChannelContext = pathname.startsWith(expectedPath);

                    // We're not in the context of the channel or thread, send
                    // notification back to native code to be displayed!
                    if (!(inChannelContext || inThreadContext)) {
                        showNotification({ notificationId: notification.id });
                    }
                    break;
                }
                default:
                    console.error(
                        "Not available or unknown notification type! I don't know how to handle it.",
                    );
            }
        },
    );
}

/**
 * Listens for any notifications tapped by the users.
 *
 * Once the notification is tapped, native Kotlin code will pick it up, and
 * then raise an event and send the notification data to the Svelte UI.
 *
 * Once the UI receives the notification, we can show the appropriate context.
 *
 * @returns
 */
export async function expectNotificationTap(): Promise<PluginListener> {
    return addPluginListener(
        TAURI_PLUGIN_NAME,
        NOTIFICATION_TAP_EVENT,
        (notification: PushNotification) => {
            const threadIndexPath = notification.threadIndex ? `/${notification.threadIndex}` : "";
            switch (notification.type) {
                case "DM": {
                    if (notification.senderId) {
                        page(`/user/${notification.senderId}`);
                    }
                    break;
                }
                case "GROUP": {
                    if (notification.groupId) {
                        page(`/group/${notification.groupId}${threadIndexPath}`);
                    }
                    break;
                }
                case "CHANNEL": {
                    if (notification.communityId && notification.channelId) {
                        page(
                            `/community/${notification.communityId}/channel/${notification.channelId}${threadIndexPath}`,
                        );
                    }
                    break;
                }
                default:
                    console.error(
                        "Not available or unknown notification type! I don't know how to handle it.",
                    );
            }
        },
    );
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

/**
 * Adds a listener for new FCM tokens. This is useful for
 * handling token refreshes in your application.
 *
 * @param handler the function to call when a new FCM token is received.
 * @returns
 */
export async function expectNewFcmToken<T>(handler: (data: T) => void): Promise<PluginListener> {
    // Set up the listener for new FCM tokens!
    return addPluginListener(TAURI_PLUGIN_NAME, NEW_FCM_TOKEN_EVENT, handler);
}

/**
 * Add a listener awaiting for the user to press the back button.
 *
 * TODO either rename this file, or move to a new one!
 *
 * @param handler runs on back press
 * @returns
 */
export async function expectBackPress(handler: () => void): Promise<PluginListener> {
    // Set up the listener for nav back presses
    return addPluginListener(TAURI_PLUGIN_NAME, BACK_PRESS_EVENT, handler);
}
