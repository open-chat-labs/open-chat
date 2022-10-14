import { push } from "svelte-spa-router";
import type { Notification, NotificationStatus } from "../domain/notifications";
import type { ServiceContainer } from "../services/serviceContainer";
import { notificationStatus, setSoftDisabled } from "../stores/notifications";
import { toUint8Array } from "./base64";
import { isCanisterUrl } from "../utils/urls";

// https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid
export const PUBLIC_VAPID_KEY =
    "BD8RU5tDBbFTDFybDoWhFzlL5+mYptojI6qqqqiit68KSt17+vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv+iV3A=";

export async function initNotificationsServiceWorker(
    api: ServiceContainer,
    onNotification: (notification: Notification) => void
): Promise<boolean> {
    if (!notificationsSupported) return false;

    await unregisterOldServiceWorker();

    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "NOTIFICATION_RECEIVED") {
            onNotification(event.data.data as Notification);
        } else if (event.data.type === "NOTIFICATION_CLICKED") {
            push(`/${event.data.path}`);
        }
    });

    notificationStatus.subscribe((status) => {
        switch (status) {
            case "granted":
                trySubscribe(api);
                break;
            case "pending-init":
                break;
            default:
                unsubscribeNotifications(api);
                break;
        }
    });

    return true;
}

// TODO this can be removed once we are sure that no-one still have the old service worker
async function unregisterOldServiceWorker() {
    const regs = await navigator.serviceWorker.getRegistrations();
    regs.forEach((reg) => {
        if (reg.scope.includes("_/raw")) {
            reg.unregister();
        }
    });
}

export function permissionToStatus(
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

export const notificationsSupported = supported();

function supported(): boolean {
    return (
        !isCanisterUrl &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

export function permissionStateToNotificationPermission(
    perm: PermissionState
): NotificationPermission {
    switch (perm) {
        case "prompt":
            return "default";
        case "denied":
            return "denied";
        case "granted":
            return "granted";
    }
}

export async function closeNotificationsForChat(chatId: string): Promise<void> {
    const registration = await getRegistration();
    if (registration !== undefined) {
        const notifications = await registration.getNotifications();
        for (const notification of notifications) {
            if (notification.data?.path.startsWith(chatId)) {
                notification.close();
            }
        }
    }
}

async function trySubscribe(api: ServiceContainer): Promise<boolean> {
    const registration = await getRegistration();
    if (registration === undefined) {
        return false;
    }

    // Check if the user has subscribed already
    let pushSubscription = await registration.pushManager.getSubscription();
    if (pushSubscription) {
        // Check if the subscription has already been pushed to the notifications canister
        if (await api.subscriptionExists(extract_p256dh_key(pushSubscription))) {
            return true;
        }
    } else {
        // Subscribe the user to webpush notifications
        pushSubscription = await subscribeUserToPush(registration);
        if (pushSubscription == null) {
            return false;
        }
    }

    // Add the subscription to the user record on the notifications canister
    try {
        await api.pushSubscription(pushSubscription);
        return true;
    } catch (e) {
        console.log("Push subscription failed: ", e);
        return false;
    }
}

async function subscribeUserToPush(
    registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(PUBLIC_VAPID_KEY),
    };

    try {
        const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        return pushSubscription;
    } catch (e) {
        console.log(e);
        return null;
    }
}

function extract_p256dh_key(subscription: PushSubscription): string {
    const json = subscription.toJSON();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const key = json.keys!["p256dh"];
    return key;
}

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

export async function unsubscribeNotifications(api: ServiceContainer): Promise<void> {
    const registration = await getRegistration();
    if (registration !== undefined) {
        const pushSubscription = await registration.pushManager.getSubscription();
        if (pushSubscription) {
            if (await api.subscriptionExists(extract_p256dh_key(pushSubscription))) {
                await api.removeSubscription(pushSubscription);
            }
        }
    }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!notificationsSupported) return undefined;

    return await navigator.serviceWorker.getRegistration("sw.js");
}
