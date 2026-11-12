import { currentUserStore, isAndroidTauriApp, type OpenChat } from "@client";
import { clearChatShortcuts, startChatShortcutPusher } from "@stores/chatShortcuts";
import { activeVideoCall } from "@stores/video";
import { invoke } from "@tauri-apps/api/core";
import { clearAllNotifications, svelteReady } from "tauri-plugin-oc-api";
import {
    expectCallActions,
    expectCallControls,
    rememberCallIdentity,
    runCallAction,
    setCallConfig,
} from "./call_bridge";
import { reportNativeExits } from "./nativeExits";
import {
    expectDeepLinks,
    expectNotificationTap,
    expectPushNotifications,
} from "./notification_channels";
import { expectPushDeviceRefresh, registerPushDevice, unregisterPushDevice } from "./push_device";
import { expectShareTarget, handleShareTarget, type PickShareChat } from "./share_target";

// The native apps' (Tauri) setup, shared by the App trees that run in them (components_mobile
// and src/native): the push device, the native event listeners and svelteReady. What the
// listeners park during a cold start is in coldStart.svelte.ts.

// Guards the one-time native setup (listeners, logout hook, svelteReady) so it runs once per page
// session. setupNativeApp() itself runs again on every userLoggedIn (account switch), but only the
// push token registration should repeat — re-registering listeners or the logout hook would stack
// duplicate handlers (e.g. a single warm tap firing multiple times).
let nativeSetupDone = false;

/**
 * Sets up push notifications and the native event listeners, then tells the shell the app is
 * ready. Call on every login in a native app (it does nothing elsewhere). `videoBridgeUrl` is the
 * build's (utils/openchatClient), if it has one. `pickShareChat` is where a share from another app
 * goes when it's for no chat in particular: components_mobile's picker by default.
 */
export function setupNativeApp(
    client: OpenChat,
    videoBridgeUrl: string | undefined,
    pickShareChat?: PickShareChat,
): void {
    if (!client.isNativeApp()) {
        return;
    }

    // Register this device's push token on every login (FCM on Android,
    // APNs on iOS). Registration is last-login-wins on the backend, so this
    // also reclaims a token still bound to a previous account on this device.
    registerPushDevice(client);

    rememberCallIdentity(videoBridgeUrl, currentUserStore.value.username);

    // Everything below registers session-scoped handlers and must run once.
    if (nativeSetupDone) {
        return;
    }
    nativeSetupDone = true;

    // Register every native event listener BEFORE signalling svelteReady:
    // the native side flushes its queued events the moment svelteReady
    // fires, and a flush that beats an in-flight listener registration
    // silently drops the event (e.g. a cold-start notification tap).
    const listenersRegistered = Promise.allSettled([
        // Listen for incoming push notifications from Firebase; also asks
        // for permission to show notifications if not already granted.
        expectPushNotifications(),

        // Listen for notifications user has tapped on
        expectNotificationTap(),

        // Listen for content shared into OpenChat from the system share sheet
        // (or via a Direct Share chat shortcut). Cold-start shares are queued
        // by the native side and delivered once svelteReady fires below.
        expectShareTarget((share) => handleShareTarget(client, share, pickShareChat)),

        // Listen for deep links (e.g. https://oc.app/group/xyz tapped from another app).
        // Cold-start deep links are queued by MainActivity and delivered once svelteReady fires.
        expectDeepLinks(),

        // Expect push token refreshes
        expectPushDeviceRefresh(client),

        // A call answered from the native ring, or a call log redial. Cold-start
        // actions are parked by the shell and opened by the router (coldStart.svelte.ts).
        expectCallActions(runCallAction),

        // The shell reports a decline from the native ring to the bridge itself. A build
        // without the URL leaves whatever the shell already holds.
        videoBridgeUrl ? setCallConfig(videoBridgeUrl) : Promise.resolve(),

        // Hang-up, mute and route changes from the phone's own call surfaces
        expectCallControls(activeVideoCall.applyNativeControl),
    ]);
    listenersRegistered.then((results) => {
        results
            .filter((r): r is PromiseRejectedResult => r.status === "rejected")
            .forEach((r) => console.error("Native listener setup failed", r.reason));
    });

    // Best-effort push hygiene on sign-out, while the identity is
    // still valid: unbind this device's token from the account,
    // delete the device token (pushes to it then dead-end at FCM,
    // and the next login mints + registers a fresh one), and empty
    // the tray and chat shortcuts so nothing from this account lingers.
    // Separate tasks, which logout runs side by side under one time cap:
    // the clear is local and must not wait on the token's network calls.
    client.onLogout(() => clearAllNotifications().catch(console.error));
    client.onLogout(() => unregisterPushDevice(client));

    // The Android shell's own crashes, ANRs and kills since the last start, which Rollbar can't
    // see otherwise
    if (isAndroidTauriApp()) {
        reportNativeExits(client);
    }

    // Push the top recent chats to the Android Sharing Shortcuts API
    // so they appear directly in the system share sheet (like
    // WhatsApp's per-chat tiles).
    startChatShortcutPusher(client);

    // Inform the native android app that svelte code is ready — but only
    // once all the listeners above are registered, so the native event
    // queue flushes into handlers that actually exist.
    listenersRegistered.then(() => svelteReady());
}

/**
 * Clears the device's chat shortcuts on every logout, so the previous user's don't survive on the
 * device. Registered once by the App root rather than at each logout site: an expired session
 * logs out from the worker agent, not just from the app's handlers.
 */
export function clearChatShortcutsOnLogout(client: OpenChat): void {
    client.onLogout(async () => {
        if (client.isNativeApp()) clearChatShortcuts();
    });
}

/** The current user has a new user id, so start again under it: the apps restart, a browser reloads. */
export function startAgain(client: OpenChat): void {
    if (client.isNativeApp()) {
        invoke("plugin:oc|restart_app");
    } else {
        window.location.reload();
    }
}
