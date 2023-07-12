import {
    type Notification,
    type OpenChat,
    type ChatIdentifier,
    routeForChatIdentifier,
} from "openchat-client";
import page from "page";

import { isCanisterUrl } from "../utils/urls";

function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

// https://datatracker.ietf.org/doc/html/draft-thomson-webpush-vapid
export const PUBLIC_VAPID_KEY =
    "BD8RU5tDBbFTDFybDoWhFzlL5+mYptojI6qqqqiit68KSt17+vt33jcqLTHKhAXdSzu6pXntfT9e4LccBv+iV3A=";

export async function subscribeToNotifications(
    client: OpenChat,
    onNotification: (notification: Notification) => void
): Promise<boolean> {
    if (!notificationsSupported) {
        console.debug("PUSH: notifications not supported");
        return false;
    }

    // Register a service worker if it hasn't already been done
    const registration = await registerServiceWorker();
    if (registration == null) {
        return false;
    }
    // Ensure the service worker is updated to the latest version
    registration.update();

    navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "NOTIFICATION_RECEIVED") {
            console.debug("PUSH: received push notification from the service worker", event.data);
            onNotification(event.data.data as Notification);
        } else if (event.data.type === "NOTIFICATION_CLICKED") {
            console.debug(
                "PUSH: notification clicked existing client routing to: ",
                event.data.path
            );
            page(`/${event.data.path}`);
        }
    });

    client.notificationStatus.subscribe((status) => {
        switch (status) {
            case "granted":
                trySubscribe(client);
                break;
            case "pending-init":
                break;
            default:
                unsubscribeNotifications(client);
                break;
        }
    });

    return true;
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

export async function closeNotificationsForChat(chatId: ChatIdentifier): Promise<void> {
    const registration = await getRegistration();
    if (registration !== undefined) {
        const notifications = await registration.getNotifications();
        for (const notification of notifications) {
            const url = routeForChatIdentifier("none", chatId);
            if (notification.data?.path.startsWith(url)) {
                notification.close();
            }
        }
    }
}

export async function closeNotifications(
    shouldClose: (notification: Notification) => boolean
): Promise<void> {
    const registration = await getRegistration();
    if (registration !== undefined) {
        const notifications = await registration.getNotifications();
        for (const notification of notifications) {
            const raw = notification?.data?.notification as Notification;
            if (raw !== undefined && shouldClose(raw)) {
                notification.close();
            }
        }
    }
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
    // Does the browser have all the support needed for web push
    if (!notificationsSupported) {
        return undefined;
    }

    try {
        return await navigator.serviceWorker.register("process.env.WEBPUSH_SERVICE_WORKER_PATH");
    } catch (e) {
        console.log(e);
        return undefined;
    }
}

async function trySubscribe(client: OpenChat): Promise<boolean> {
    console.debug("PUSH: checking user's subscription status");
    const registration = await getRegistration();
    if (registration === undefined) {
        console.debug("PUSH: couldn't find push notifications service worker");
        return false;
    }

    // Check if the user has subscribed already
    let pushSubscription = await registration.pushManager.getSubscription();
    if (pushSubscription) {
        console.debug("PUSH: found existing push subscription");
        // Check if the subscription has already been pushed to the notifications canister
        if (await client.subscriptionExists(extract_p256dh_key(pushSubscription))) {
            console.debug("PUSH: subscription exists in the backend");
            return true;
        }
    } else {
        // Subscribe the user to webpush notifications
        console.debug("PUSH: creating a new subscription");
        pushSubscription = await subscribeUserToPush(registration);
        if (pushSubscription == null) {
            return false;
        }
    }

    // Add the subscription to the user record on the notifications canister
    try {
        console.debug("PUSH: saving new subscription", pushSubscription, pushSubscription.toJSON());
        await client.pushSubscription(pushSubscription.toJSON());
        return true;
    } catch (e) {
        console.log("PUSH: Push subscription failed: ", e);
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

export async function unsubscribeNotifications(client: OpenChat): Promise<void> {
    console.debug("PUSH: unsubscribing from notifications");
    const registration = await getRegistration();
    if (registration !== undefined) {
        const pushSubscription = await registration.pushManager.getSubscription();
        if (pushSubscription) {
            if (await client.subscriptionExists(extract_p256dh_key(pushSubscription))) {
                console.debug("PUSH: removing push subscription");
                await client.removeSubscription(pushSubscription.toJSON());
            }
        }
    }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!notificationsSupported) return undefined;
    return await navigator.serviceWorker.getRegistration("process.env.WEBPUSH_SERVICE_WORKER_PATH");
}
