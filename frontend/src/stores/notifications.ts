import { derived, writable } from "svelte/store";
import { getSoftDisabled } from "../utils/caching";
import {
    notificationsSupported,
    permissionStateToNotificationPermission,
    permissionToStatus,
} from "../utils/notifications";

export const notificationsSoftDisabled = writable<boolean>(false);

export const notificationPermission = writable<NotificationPermission | "pending-init">("pending-init");

export async function initNotificationStores(): Promise<void> {
    if (!notificationsSupported) {
        notificationPermission.set("denied");
        return;
    }

    const softDisabled = await getSoftDisabled();
    notificationsSoftDisabled.set(softDisabled);

    if (navigator.permissions) {
        navigator.permissions.query({ name: "notifications" }).then((perm) => {
            notificationPermission.set(permissionStateToNotificationPermission(perm.state));
            perm.onchange = () => notificationPermission.set(permissionStateToNotificationPermission(perm.state));
        });
    } else {
        notificationPermission.set(Notification.permission);
    }
}

export const notificationStatus = derived(
    [notificationsSoftDisabled, notificationPermission],
    ([$softDisabled, $perm]) => {
        if (!notificationsSupported) {
            return "unsupported";
        }
        if ($softDisabled) {
            return "soft-denied";
        }
        return permissionToStatus($perm);
    }
);
