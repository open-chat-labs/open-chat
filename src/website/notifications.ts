import { PUBLIC_VAPID_KEY } from "./constants";
import { Option } from "./domain/model/common";
import { UserId } from "./domain/model/users";
import notificationsService from "./services/notifications/service";
import * as base64 from "./utils/base64Functions";

// https://web-push-book.gauntface.com/common-notification-patterns/
// - Once subscribed send the user an initial notification a la slack "Nice, notifications are enabled!"
// https://www.youtube.com/watch?v=_dXBibRO0SM&t=103s

export enum Status {
    Unsupported,
    Prompt,
    Denied,
    Granted,
}

export async function status() : Promise<Status> {
    // Does the browser and environment have all the support needed for web push
    if (!supported()) {
        return Status.Unsupported;
    }

    // If the user has explicitly soft-disabled notifications, then don't show bar
    if (await softDisabled()) {
        return Status.Denied;
    }

    // If the user has already either hard enabled or hard disabled notifications then don't show the bar
    const permission = await hardPermission();

    switch (permission) {
        case "denied": return Status.Denied;
        case "granted": return Status.Granted;
        default: return Status.Prompt;
    }
}

export function supported() : boolean {
    return "serviceWorker" in navigator 
        && "PushManager" in window 
        && "Notification" in window
}

export async function trySubscribe(userId: UserId) : Promise<boolean> {
    // Does the browser have all the support needed for web push
    if (!supported()) {
        return false;
    }

    // Register a service worker if it hasn't already been done
    let registration = await registerServiceWorker();
    if (registration == null) {
        return false;
    }

    // Only proceed if the user hasn't explicitly soft-disabled notifications
    if (await softDisabled()) {
        return false;
    }

    // Only proceed if the user has granted hard permission to send notifications
    const permission = await hardPermission();
    if (permission !== "granted") {
        return false;
    }

    // Check if the user has subscribed already
    let pushSubscription = await registration.pushManager.getSubscription();
    if (pushSubscription) {
        // Check if the subscription has already been pushed to the notifications canister
        if (await notificationsService.subscriptionExists(userId, extract_p256dh_key(pushSubscription))) {
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
        await notificationsService.pushSubscription(userId, pushSubscription);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}

export async function askForPermission() : Promise<NotificationPermission> {
    const result: NotificationPermission = await new Promise(function (resolve, reject) {
        const permissionResult = Notification.requestPermission(function (res) {
            resolve(res);
        });

        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    });

    return result;
}

// TODO: need to store in local storage
let _softDisabled = false;

export async function softDisabled() : Promise<boolean> {
    return _softDisabled;
}

export async function setSoftDisabled(disabled: boolean) : Promise<void> {
    _softDisabled = disabled;
}

async function registerServiceWorker() : Promise<Option<ServiceWorkerRegistration>> {
    try {
        const sw_path = process.env.WEBPUSH_SERVICE_WORKER_PATH!;
        let registration = await navigator.serviceWorker.register(sw_path);
        return registration;
    } catch (e) {
        console.log(e);
        return null;
    }
}

async function hardPermission() : Promise<NotificationPermission> {
    if (navigator.permissions) {
        let result = await navigator.permissions.query({ name: "notifications" });
        switch (result.state) {
            case "prompt": return "default";            
            case "denied": return "denied";            
            case "granted": return "granted";            
        }
    }

    return Notification.permission;
}

async function subscribeUserToPush(registration: ServiceWorkerRegistration) : Promise<Option<PushSubscription>> {
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: base64.toUint8Array(PUBLIC_VAPID_KEY)
    };

    try {
        let pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        return pushSubscription;
    } catch (e) {
        console.log(e);
        return null;
    }
}

function extract_p256dh_key(subscription: PushSubscription) : string {
    const json = subscription.toJSON();
    const key = json.keys!["p256dh"];
    return key;
}