import { writable } from "svelte/store";

export enum ToastType {
    Success,
    Failure,
}

export type Toast = {
    text: string;
    type: ToastType;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (text: string): void => {
        return update(() => ({
            text,
            type: ToastType.Failure,
        }));
    },
    showSuccessToast: (text: string): void => {
        setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            type: ToastType.Success,
            text,
        }));
    },
    hideToast: (): void => update(() => undefined),
};
