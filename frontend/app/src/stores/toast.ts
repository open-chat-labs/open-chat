import { type Readable, writable, readable } from "svelte/store";
import type { ResourceKey } from "openchat-client";

export enum ToastType {
    Success,
    Failure,
}

export type Toast = {
    resourceKey: Readable<ResourceKey | undefined>;
    type: ToastType;
    err?: unknown;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (resourceKey: ResourceKey | Readable<ResourceKey | undefined>, err?: unknown): void => {
        return update(() => ({
            resourceKey: "subscribe" in resourceKey ? resourceKey : readable(resourceKey),
            type: ToastType.Failure,
            err,
        }));
    },
    showSuccessToast: (resourceKey: ResourceKey): void => {
        window.setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            resourceKey: readable(resourceKey),
            type: ToastType.Success,
        }));
    },
    hideToast: (): void => update(() => undefined),
};
