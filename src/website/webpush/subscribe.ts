import { Option } from "../domain/model/common";

export async function registerServiceWorker() : Promise<Option<ServiceWorkerRegistration>> {
    try {
        console.log("Start registering OC service worker");
        let registration = await navigator.serviceWorker.register("sw.js", { scope: "/webpush/" });
        console.log("Finish registering OC service worker");
        return registration;
    } catch (e) {
        console.log(e);
        return null;
    }
}
