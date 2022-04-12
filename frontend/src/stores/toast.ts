import { writable } from "svelte/store";

export enum ToastType {
    Success,
    Failure,
}

export type Toast = {
    text: string;
    args?: unknown;
    type: ToastType;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (text: string, args?: unknown): void => {
        return update(() => ({
            text,
            args,
            type: ToastType.Failure,
        }));
    },
    showSuccessToast: (text: string, args?: unknown): void => {
        setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            type: ToastType.Success,
            text,
            args,
        }));
    },
    hideToast: (): void => update(() => undefined),
};
