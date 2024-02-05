import { writable } from "svelte/store";
import type { ResourceKey } from "../i18n/i18n";

export enum ToastType {
    Success,
    Failure,
}

export type Toast = {
    resourceKey: ResourceKey;
    type: ToastType;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (resourceKey: ResourceKey): void => {
        return update(() => ({
            resourceKey,
            type: ToastType.Failure,
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
