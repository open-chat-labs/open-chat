import type { Readable } from "svelte/store";
import type { ResourceKey } from "../utils";

export type FailureToast = {
    kind: "failure";
    resourceKey: Readable<ResourceKey | undefined>;
    err?: unknown;
};

export type SuccessToast = {
    kind: "success";
    resourceKey: Readable<ResourceKey | undefined>;
};

export type Toast = SuccessToast | FailureToast;

/**
 * What an action came to, for the app to show (`toastStore.showOutcome`): its failure, or its
 * success when it has something to say. Logic modules return it; they never show a toast.
 */
export type ToastOutcome =
    | { kind: "success"; message?: ResourceKey }
    | { kind: "failed"; message: ResourceKey };
