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
