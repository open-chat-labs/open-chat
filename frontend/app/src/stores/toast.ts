import { writable } from "svelte/store";

export enum ToastType {
    Success,
    Failure,
}

type InterpolationValues =
    | Record<string, string | number | boolean | Date | null | undefined>
    | undefined;

type MessageObject = {
    values?: InterpolationValues;
};

export type Toast = {
    text: string;
    args?: MessageObject;
    type: ToastType;
};

const { subscribe, update } = writable<Toast | undefined>(undefined);

export const toastStore = {
    subscribe,
    showFailureToast: (text: string, args?: MessageObject): void => {
        return update(() => ({
            text,
            args,
            type: ToastType.Failure,
        }));
    },
    showSuccessToast: (text: string, args?: MessageObject): void => {
        window.setTimeout(() => update(() => undefined), 2500);
        return update(() => ({
            type: ToastType.Success,
            text,
            args,
        }));
    },
    hideToast: (): void => update(() => undefined),
};
