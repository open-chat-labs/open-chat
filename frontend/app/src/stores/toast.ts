import { type ResourceKey, type Toast } from "@client";
import { readable, writable, type Readable } from "svelte/store";

export type ToastOutcome =
    | { kind: "success"; message?: ResourceKey }
    | { kind: "failed"; message: ResourceKey };

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
    /** Shows what an action returned: its failure, or its success when it has something to say */
    showOutcome: (outcome: ToastOutcome): void => {
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
        } else if (outcome.message !== undefined) {
            toastStore.showSuccessToast(outcome.message);
        }
    },
    hideToast: (): void => update(() => undefined),
};
