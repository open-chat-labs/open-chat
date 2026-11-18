import { i18nKey } from "@src/i18n/i18n";
import {
    startCallToast,
    type CallSession,
    type StartCallOutcome,
} from "@src/logic/video/callSession.svelte";
import { toastStore } from "@src/stores/toast";

/** Tells the user about a call they asked for (`startCallToast`), in every tree. */
export function toastStartCall(outcome: StartCallOutcome | undefined): void {
    const toast = startCallToast(outcome);
    if (toast?.kind === "success") toastStore.showSuccessToast(toast.message);
    if (toast?.kind === "failure") toastStore.showFailureToast(toast.message);
}

/**
 * Tells the user what ended or refused them in a call, once: the host ending a broadcast, or the
 * host turning down their request to speak. Run in an effect, in every tree that draws calls.
 */
export function toastCallEndings(session: Pick<CallSession, "hostEnded" | "denied">): void {
    if (session.hostEnded) {
        toastStore.showSuccessToast(i18nKey("videoCall.hostEnded"));
        session.hostEnded = false;
    }
    if (session.denied) {
        toastStore.showFailureToast(i18nKey("videoCall.denied"));
        session.denied = false;
    }
}
