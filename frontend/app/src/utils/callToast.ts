import { startCallToast, type StartCallOutcome } from "@src/logic/video/callSession.svelte";
import { toastStore } from "@src/stores/toast";

/** Tells the user about a call they asked for (`startCallToast`), in every tree. */
export function toastStartCall(outcome: StartCallOutcome | undefined): void {
    const toast = startCallToast(outcome);
    if (toast?.kind === "success") toastStore.showSuccessToast(toast.message);
    if (toast?.kind === "failure") toastStore.showFailureToast(toast.message);
}
