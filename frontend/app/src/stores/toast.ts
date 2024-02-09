import { writable } from "svelte/store";
import type { ResourceKey } from "../i18n/i18n";

export enum ToastType {
    Success,
    Failure,
}

export type Toast = {
    resourceKey: ResourceKey;
    type: ToastType;
    err?: unknown;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (resourceKey: ResourceKey, err?: unknown): void => {
        return update(() => ({
            resourceKey,
            type: ToastType.Failure,
            err,
        }));
    },
    showSuccessToast: (resourceKey: ResourceKey): void => {
        window.setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            resourceKey,
            type: ToastType.Success,
        }));
    },
    hideToast: (): void => update(() => undefined),
};
