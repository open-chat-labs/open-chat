import type { NotificationStatus } from "openchat-agent";
import { derived, writable } from "svelte/store";
import { getSoftDisabled, storeSoftDisabled } from "../utils/caching";

const notificationsSupported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const softDisabledStore = writable<boolean>(false);
const browserPermissionStore = writable<NotificationPermission | "pending-init">("pending-init");

export async function initNotificationStores(): Promise<void> {
    if (!notificationsSupported) {
        return;
    }

    const softDisabled = await getSoftDisabled();
    softDisabledStore.set(softDisabled);

    if (navigator.permissions) {
        navigator.permissions.query({ name: "notifications" }).then((perm) => {
            browserPermissionStore.set(permissionStateToNotificationPermission(perm.state));
            perm.onchange = () =>
                browserPermissionStore.set(permissionStateToNotificationPermission(perm.state));
        });
    } else {
        browserPermissionStore.set(Notification.permission);
    }
}

export function setSoftDisabled(softDisabled: boolean): Promise<void> {
    // add to indexdb so service worker has access
    return storeSoftDisabled(softDisabled).finally(() => {
        // add to svelte store
        softDisabledStore.set(softDisabled);
    });
}

function permissionStateToNotificationPermission(perm: PermissionState): NotificationPermission {
    switch (perm) {
        case "prompt":
            return "default";
        case "denied":
            return "denied";
        case "granted":
            return "granted";
    }
}

function permissionToStatus(
    permission: NotificationPermission | "pending-init"
): NotificationStatus {
    switch (permission) {
        case "pending-init":
            return "pending-init";
        case "denied":
            return "hard-denied";
        case "granted":
            return "granted";
        default:
            return "prompt";
    }
}

export const notificationStatus = derived(
    [softDisabledStore, browserPermissionStore],
    ([softDisabled, browserPermission]) => {
        if (!notificationsSupported) {
            return "unsupported";
        }
        if (softDisabled) {
            return "soft-denied";
        }
        return permissionToStatus(browserPermission);
    }
);

export async function askForNotificationPermission(): Promise<NotificationPermission> {
    const result: NotificationPermission = await new Promise(function (resolve, reject) {
        const permissionResult = Notification.requestPermission(function (res) {
            resolve(res);
            setSoftDisabled(false);
        });

        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    });

    return result;
}
