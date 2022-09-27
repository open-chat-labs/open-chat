import { derived, writable } from "svelte/store";
import { getSoftDisabled, storeSoftDisabled } from "../utils/caching";
import { rollbar } from "../utils/logging";
import {
    notificationsSupported,
    permissionStateToNotificationPermission,
    permissionToStatus,
} from "../utils/notifications";

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
            perm.onchange = () => browserPermissionStore.set(permissionStateToNotificationPermission(perm.state));
        });
    } else {
        browserPermissionStore.set(Notification.permission);
    }
}

export function setSoftDisabled(softDisabled: boolean): void {
    // add to indexdb so service worker has access
    storeSoftDisabled(softDisabled).catch((err) =>
        rollbar.error("Failed to set soft disabled", err)
    );

    // add to svelte store
    softDisabledStore.set(softDisabled);
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
