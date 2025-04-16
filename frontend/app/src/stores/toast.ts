import { type ResourceKey, type Toast } from "openchat-client";
import { readable, writable, type Readable } from "svelte/store";

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (
        resourceKey: ResourceKey | Readable<ResourceKey | undefined>,
        err?: unknown,
    ): void => {
        return update(() => ({
            kind: "failure",
            resourceKey: "subscribe" in resourceKey ? resourceKey : readable(resourceKey),
            err,
        }));
    },
    showSuccessToast: (resourceKey: ResourceKey): void => {
        window.setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            kind: "success",
            resourceKey: readable(resourceKey),
        }));
    },
    hideToast: (): void => update(() => undefined),
};
