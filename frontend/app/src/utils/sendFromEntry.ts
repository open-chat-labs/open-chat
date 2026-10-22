import type { SendMessageOutcome } from "@client";
import { i18nKey } from "@i18n/i18n";
import { toastStore } from "@src/stores/toast";

/**
 * Waits for a send from a message entry (the legacy trees') and says whether the entry should
 * clear its text: once the message shows in the chat, or when nothing was sent to wait for (an
 * edit). Refused before it was sent (the rules turned down, the PIN dismissed, throttled, a send
 * already on its way), the text stays; a failure says so.
 */
export async function clearsEntry(
    result: Promise<SendMessageOutcome> | "nothing_sent",
    sending: (busy: boolean) => void,
): Promise<boolean> {
    if (result === "nothing_sent") return true;
    sending(true);
    try {
        const outcome = await result;
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(i18nKey("errorSendingMessage"));
        }
        return outcome.kind === "posted";
    } finally {
        sending(false);
    }
}
