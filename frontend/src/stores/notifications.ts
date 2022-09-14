import { derived, writable } from "svelte/store";
import type { Notification } from "../domain/notifications";
import type { ServiceContainer } from "../services/serviceContainer";
import { getSoftDisabled } from "../utils/caching";
import {
    notificationsSupported,
    permissionStateToNotificationPermission,
    permissionToStatus,
    trySubscribe,
} from "../utils/notifications";

export const notificationsSoftDisabled = writable<boolean>(false);

export const notificationPermission = writable<NotificationPermission | "pending-init">("pending-init");

function convertAndSubscribe(
    api: ServiceContainer,
    userId: string,
    perm: PermissionState,
    onNotification: (notification: Notification) => void
): NotificationPermission {
    const notifPerm = permissionStateToNotificationPermission(perm);
    if (notifPerm === "granted") {
        trySubscribe(api, userId, onNotification);
    }
    return notifPerm;
}

export async function initNotificationStores(
    api: ServiceContainer,
    userId: string,
    onNotification: (notification: Notification) => void
): Promise<void> {
    if (!notificationsSupported) {
        notificationPermission.set("denied");
        return;
    }
    const softDisabled = await getSoftDisabled();
    notificationsSoftDisabled.set(softDisabled);
    if (navigator.permissions) {
        navigator.permissions.query({ name: "notifications" }).then((perm) => {
            notificationPermission.set(
                convertAndSubscribe(api, userId, perm.state, onNotification)
            );
            perm.onchange = () => {
                notificationPermission.set(
                    convertAndSubscribe(api, userId, perm.state, onNotification)
                );
            };
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
