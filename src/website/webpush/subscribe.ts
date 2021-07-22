import { APP_SERVICE_WORKER_KEY } from "../constants";
import { Option } from "../domain/model/common";
import * as base64 from "../utils/base64Functions";

export function isWebpushSupported() : boolean {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function requestPermission() : Promise<boolean> {
    const result: NotificationPermission = await new Promise(function (resolve, reject) {
        const permissionResult = Notification.requestPermission(function (res) {
            resolve(res);
        });

        if (permissionResult) {
            permissionResult.then(resolve, reject);
        }
    });

    return result === "granted";
}

export async function registerServiceWorker() : Promise<Option<ServiceWorkerRegistration>> {
    try {
        return await navigator.serviceWorker.register("/service-worker.js");
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function subscribeUserToPush(registration: ServiceWorkerRegistration) : Promise<Option<string>> {
    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: base64.toUint8Array(APP_SERVICE_WORKER_KEY)
    };

    try {
        let pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        return JSON.stringify(pushSubscription);
    } catch (e) {
        console.log(e);
        return null;
    }
}