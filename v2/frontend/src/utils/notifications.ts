import { push } from "svelte-spa-router";
import type { NotificationStatus } from "../domain/notifications";
import type { ServiceContainer } from "../services/serviceContainer";
import { setSoftDisabled } from "../stores/notifications";
import { toUint8Array } from "./base64";

console.log("SWPATH", "process.env.WEBPUSH_SERVICE_WORKER_PATH");

// https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid
export const PUBLIC_VAPID_KEY =
    "BD8RU5tDBbFTDFybDoWhFzlL5-mYptojI6qqqqiit68KSt17-vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv-iV3A=";

export function permissionToStatus(permission: NotificationPermission): NotificationStatus {
    switch (permission) {
        case "denied":
            return "hard-denied";
        case "granted":
            return "granted";
        default:
            return "prompt";
    }
}

export function supported(): boolean {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
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
    const registration = await registerServiceWorker();
    if (registration != null) {
        const notifications = await registration.getNotifications();
        for (const notification of notifications) {
            if (notification.data?.chatId === chatId) {
                notification.close();
            }
        }
    }
}

export async function unregister(): Promise<boolean> {
    const registration = await registerServiceWorker();
    if (registration == null) {
        return false;
    }
    return registration.unregister();
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
    // Does the browser have all the support needed for web push
    if (!supported()) {
        return undefined;
    }

    try {
        return await navigator.serviceWorker.register("process.env.WEBPUSH_SERVICE_WORKER_PATH");
    } catch (e) {
        console.log(e);
        return undefined;
    }
}

export async function trySubscribe(api: ServiceContainer, userId: string): Promise<boolean> {
    // Register a service worker if it hasn't already been done
    const registration = await registerServiceWorker();
    if (registration == null) {
        return false;
    }

    // Ensure the service worker is updated to the latest version
    registration.update();

    // When a notifcation is clicked the service worker sends us a message
    // with the chat to select
    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "NOTIFICATION_CLICKED") {
            closeNotificationsForChat(event.data.chatId);
            push(`/${event.data.chatId}`);
        }
    });

    // Check if the user has subscribed already
    let pushSubscription = await registration.pushManager.getSubscription();
    if (pushSubscription) {
        // Check if the subscription has already been pushed to the notifications canister
        if (await api.subscriptionExists(userId, extract_p256dh_key(pushSubscription))) {
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
        await api.pushSubscription(userId, pushSubscription);
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
