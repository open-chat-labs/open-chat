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
    showToast: (toast: Toast): void => {
        if (toast.type === ToastType.Success) {
            setTimeout(() => update(() => undefined), 2500);
        }
        return update(() => toast);
    },
    hideToast: (): void => update(() => undefined),
};
