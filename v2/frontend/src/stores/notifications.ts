import { derived, readable, writable } from "svelte/store";
import type { ServiceContainer } from "../services/serviceContainer";
import {
    permissionStateToNotificationPermission,
    permissionToStatus,
    supported,
    trySubscribe,
} from "../utils/notifications";

const SOFT_DISABLE_KEY = "openchat_notifications_soft_disabled";

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

export function setSoftDisabled(softDisabled: boolean): void {
    localStorage.setItem(SOFT_DISABLE_KEY, softDisabled.toString());
    notificationsSoftDisabled.set(softDisabled);
}

export function initNotificationStores(api: ServiceContainer, userId: string): void {
    notificationsSoftDisabled.set(localStorage.getItem(SOFT_DISABLE_KEY) === "true");
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
