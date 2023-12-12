import { isCanisterUrl } from "../utils/urls";

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
    // Does the browser have all the support needed for web push
    if (!notificationsSupported) {
        return undefined;
    }

    try {
        const registration = await navigator.serviceWorker.register(
            "process.env.SERVICE_WORKER_PATH",
            {
                type: "module",
            },
        );
        registration.update();
        return registration;
    } catch (e) {
        console.log(e);
        return undefined;
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
