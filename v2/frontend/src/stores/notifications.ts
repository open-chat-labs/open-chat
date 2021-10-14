import { derived, readable, writable } from "svelte/store";
import type { ServiceContainer } from "../services/serviceContainer";
import { getSoftDisabled } from "../utils/caching";
import {
    permissionStateToNotificationPermission,
    permissionToStatus,
    supported,
    trySubscribe,
} from "../utils/notifications";

export const notificationsSupported = readable<boolean>(supported());

export const notificationsSoftDisabled = writable<boolean>(false);

export const notificationPermission = writable<NotificationPermission>("default");

function convertAndSubscribe(
    api: ServiceContainer,
    userId: string,
    perm: PermissionState
): NotificationPermission {
    const notifPerm = permissionStateToNotificationPermission(perm);
    if (notifPerm === "granted") {
        trySubscribe(api, userId);
    }
    return notifPerm;
}

export async function initNotificationStores(api: ServiceContainer, userId: string): Promise<void> {
    const softDisabled = await getSoftDisabled();
    notificationsSoftDisabled.set(softDisabled);
    if (navigator.permissions) {
        navigator.permissions.query({ name: "notifications" }).then((perm) => {
            notificationPermission.set(convertAndSubscribe(api, userId, perm.state));
            perm.onchange = () => {
                notificationPermission.set(convertAndSubscribe(api, userId, perm.state));
            };
        });
    } else {
        notificationPermission.set(Notification.permission);
    }
}

export const notificationStatus = derived(
    [notificationsSupported, notificationsSoftDisabled, notificationPermission],

    ([$supported, $softDisabled, $perm]) => {
        if (!$supported) {
            return "unsupported";
        }
        if ($softDisabled) {
            return "soft-denied";
        }
        return permissionToStatus($perm);
    }
);
