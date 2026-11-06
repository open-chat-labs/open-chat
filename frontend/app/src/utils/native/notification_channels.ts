import { addPluginListener, invoke, PluginListener } from "@tauri-apps/api/core";
import { isIosTauriApp } from "@shared";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { getWindowInsets, openUrl, showNotification, type WindowInsets } from "tauri-plugin-oc-api";
import { navigate } from "@utils/navigation";
import { isLandingPagePath } from "@utils/urls";
import { coldStartIntents } from "./coldStart.svelte";
import { chatOnScreen, type PushNotification } from "./push_notification";

const TAURI_PLUGIN_NAME = "oc";
const PUSH_NOTIFICATION_EVENT = "push-notification";
// Must match the event name Kotlin fires in OCPluginCompanion.cacheNewFcmToken.
const NEW_FCM_TOKEN_EVENT = "fcm-token-refresh";
const NOTIFICATION_TAP_EVENT = "notification-tap";
const BACK_PRESS_EVENT = "back-pressed";
const WINDOW_INSET_CHANGE_EVENT = "window-inset-change";

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
            // Not shown when its chat is on screen, which renders the message itself
            if (!chatOnScreen(notification, window.location.pathname)) {
                showNotification({ notificationId: notification.id });
            }
        },
    );
}

/**
 * Maps a tapped notification to its in-app route, or null if the payload
 * doesn't describe a navigable destination.
 */
function notificationPath(notification: PushNotification): string | null {
    const threadIndexPath = notification.threadIndex ? `/${notification.threadIndex}` : "";
    switch (notification.type) {
        case "DM":
            return notification.senderId ? `/user/${notification.senderId}` : null;
        case "GROUP":
            return notification.groupId ? `/group/${notification.groupId}${threadIndexPath}` : null;
        case "CHANNEL":
            return notification.communityId && notification.channelId
                ? `/community/${notification.communityId}/channel/${notification.channelId}${threadIndexPath}`
                : null;
        default:
            return null;
    }
}

/**
 * Listens for any notifications tapped by the users.
 *
 * Warm taps arrive as a "notification-tap" event; taps that happened before
 * the WebView was ready are persisted natively and pulled here once the
 * listener is registered, so nothing is lost to the startup race.
 *
 * @returns
 */
export async function expectNotificationTap(): Promise<PluginListener> {
    const listener = await addPluginListener(
        TAURI_PLUGIN_NAME,
        NOTIFICATION_TAP_EVENT,
        (notification: PushNotification) => {
            const path = notificationPath(notification);
            if (path) {
                navigate(path, "notification");
            } else {
                console.error(
                    "Not available or unknown notification type! I don't know how to handle it.",
                );
            }
        },
    );

    // Pull any tap stored during cold start (before the listener was ready).
    // Stored for Router.svelte to consume instead of auto-selecting the default chat.
    let pending: { payload?: string } | undefined;
    try {
        pending = await invoke<{ payload?: string }>("plugin:oc|get_pending_notification_tap");
    } catch (e) {
        console.error("Notification tap: get_pending_notification_tap invoke failed", e);
    }
    if (pending?.payload) {
        try {
            const path = notificationPath(JSON.parse(pending.payload) as PushNotification);
            if (path) {
                console.log("Notification tap: cold-start pending path stored", path);
                // parked for the router, which opens it once it can (coldStart.svelte.ts)
                coldStartIntents.parkNotificationTap(path);
            }
        } catch (e) {
            console.error("Notification tap: failed to parse pending payload", pending.payload, e);
        }
    }

    return listener;
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
export async function expectNewFcmToken(handler: (token: string) => void): Promise<PluginListener> {
    // Set up the listener for new FCM tokens! The native side sends
    // { fcmToken: "..." }, the handler wants the bare token.
    return addPluginListener(
        TAURI_PLUGIN_NAME,
        NEW_FCM_TOKEN_EVENT,
        (data: { fcmToken?: string }) => {
            if (data?.fcmToken) {
                handler(data.fcmToken);
            } else {
                console.error("FCM token refresh event carried no token", data);
            }
        },
    );
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

/**
 * Data shape epxected to be received from the native code, informing us of the
 * navigation type that the Android app is using, and if the software keyboard
 * is open/visible.
 */
/** The window-inset-change event's payload (Android). */
export type WindowInsetChange = WindowInsets;

/**
 * Use this function to detect keyboard open/close, or device nav type (buttons
 * or gestures)
 *
 * @param handler runs when insets change, nav type or keyboard open
 * @returns
 */
export async function expectWindowInsetChange(
    handler: (data: WindowInsetChange) => void,
): Promise<PluginListener> {
    return addPluginListener(TAURI_PLUGIN_NAME, WINDOW_INSET_CHANGE_EVENT, handler);
}

/**
 * Follows the Android app's window insets: each change, and the current ones at once
 * (`getWindowInsets`), since the app reports them as they happen and a listener that starts later
 * would otherwise wait for the next change. They aren't held back for svelteReady, so this works
 * before sign-in too. A shell older than `getWindowInsets` only has the changes.
 */
export async function followWindowInsets(
    handler: (data: WindowInsetChange) => void,
): Promise<PluginListener> {
    // listening first, so a change between the two can't be missed; the current ones are at least
    // as new as anything sent before
    const listener = await expectWindowInsetChange(handler);
    try {
        const current = await getWindowInsets();
        if (current !== undefined) handler(current);
    } catch {
        // an older shell: the next change brings them
    }
    return listener;
}

const DEEP_LINK_EVENT = "deep-link";

/**
 * Call once on native app startup (inside isNativeApp() guard).
 *
 * The Tauri deep-link plugin cannot be used directly because tao 0.35.2
 * crashes on Android when a https:// VIEW intent arrives (null getType()
 * causes a JNI NullPtr panic). Instead, MainActivity intercepts the intent
 * before handing it to tao and fires a "deep-link" event via OCPluginCompanion,
 * which we listen for here.
 */
/**
 * Opens a deep link, warm or cold start alike. Returns whether it navigated inside the app.
 */
export function openDeepLink(url: string): boolean {
    try {
        const { pathname, search } = new URL(url);
        // Landing / marketing pages (blog, whitepaper, etc.) are not real
        // in-app destinations. The OS delivers these oc.app links to us as
        // deep links because oc.app is a verified associated domain - open
        // them in an external browser tab instead of navigating in-app.
        if (isLandingPagePath(pathname)) {
            openUrl({ url }).catch((e) =>
                console.error("Deep link: failed to open external URL", e),
            );
            return false;
        }
        navigate(pathname + search, "notification");
        return true;
    } catch {
        console.error("Deep link: failed to parse URL", url);
        return false;
    }
}

export async function expectDeepLinks(): Promise<PluginListener> {
    const handleDeepLink = (url: string) => {
        console.log("Deep link: received warm-start event", url);
        openDeepLink(url);
    };

    const listener = await addPluginListener(
        TAURI_PLUGIN_NAME,
        DEEP_LINK_EVENT,
        (payload: { url: string }) => handleDeepLink(payload.url),
    );

    // On Android deep links are intercepted natively (see the tao crash note
    // above) and re-fired as the plugin event handled just here. On iOS the
    // standard Tauri deep-link plugin works, so listen to it directly for
    // openchat:// custom-scheme links.
    if (isIosTauriApp()) {
        try {
            const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
            await onOpenUrl((urls) => urls.forEach(handleDeepLink));
        } catch (e) {
            console.error("Deep link: failed to register iOS onOpenUrl listener", e);
        }
    }

    // Pull any URL stored during cold start (before WebView was ready).
    // Store it for Router.svelte to consume instead of auto-selecting the default chat.
    try {
        const pending = await invoke<{ url?: string }>("plugin:oc|get_pending_deep_link");
        if (pending?.url) {
            console.log("Deep link: cold-start pending URL stored", pending.url);
            // parked for the router, which opens it once it can (coldStart.svelte.ts)
            coldStartIntents.parkDeepLink(pending.url);
        }
    } catch (e) {
        console.error("Deep link: get_pending_deep_link invoke failed", e);
    }

    return listener;
}
