import { isIosTauriApp } from "@shared";
import type { OpenChat } from "@client";
import { deleteFcmToken, getApnsDevice, getFcmToken } from "tauri-plugin-oc-api";
import { addPluginListener, type PluginListener } from "@tauri-apps/api/core";
import { expectNewFcmToken } from "./notification_channels";

// Must match the event name Swift fires in Push.didRegister
const NEW_APNS_TOKEN_EVENT = "apns-token-refresh";

// This phone's push registration: an FCM token on Android, an APNs device on iOS.
//
// Registration runs unconditionally on every login. It is last-login-wins on the backend, so it
// also reclaims a token still bound to a previous account on this device.
export function registerPushDevice(client: OpenChat) {
    if (isIosTauriApp()) {
        getApnsDevice()
            .then((device) => {
                if (!device.alertToken) {
                    console.error("No APNs token received");
                    return;
                }
                return client.addApnsDevice(device);
            })
            .catch(console.error);
        return;
    }

    getFcmToken().then((token) => {
        if (!token) {
            // TODO do we handle this somehow? Debounce, try again?
            console.error("No FCM token received");
            return;
        }

        addFcmToken(client, token);
    });
}

// Registers the new token when the OS replaces this device's token
export function expectPushDeviceRefresh(client: OpenChat): Promise<PluginListener> {
    if (isIosTauriApp()) {
        return addPluginListener("oc", NEW_APNS_TOKEN_EVENT, (data: { alertToken?: string }) => {
            if (data?.alertToken) {
                client.addApnsDevice({ alertToken: data.alertToken }).catch(console.error);
            }
        });
    }
    return expectNewFcmToken((token) => addFcmToken(client, token));
}

// Best-effort push hygiene on sign-out, while the identity is still valid: unbind this device from
// the account. On Android the device token is deleted too, so pushes to it dead-end at FCM and the
// next login mints and registers a fresh one.
export async function unregisterPushDevice(client: OpenChat): Promise<void> {
    if (isIosTauriApp()) {
        const device = await getApnsDevice().catch(() => ({}) as { alertToken?: string });
        if (device.alertToken) {
            await client.removeApnsDevice(device).catch(console.error);
        }
        return;
    }

    const token = await getFcmToken().catch(() => null);
    if (token) {
        await client.removeFcmToken(token).catch(console.error);
    }
    await deleteFcmToken().catch(console.error);
}

function addFcmToken(client: OpenChat, token: string) {
    client
        .addFcmToken(token)
        .then(() => console.info("FCM token updated successfully"))
        .catch(console.error);
}
