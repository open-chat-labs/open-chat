import { profileStore } from "../stores/profiling";
import { configKeys } from "./config";

export function showTrace() {
    return localStorage.getItem(configKeys.profile) === "true";
}

export function measure<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    return fn().then((res) => {
        const end = performance.now();
        console.log(key, end - start);
        profileStore.capture(key, end - start);
        return res;
    });
}
