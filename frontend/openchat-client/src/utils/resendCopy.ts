import type { RulesRefusedSend } from "@shared";

/**
 * Where the copy of a message being sent again is kept: shown failed (with Retry), queued for the
 * connection (the offline send queue owns it, and sends it again itself), or neither.
 */
export type FailedCopy = "failed" | "queued" | "none";

export function failedCopy(failed: boolean, queued: boolean): FailedCopy {
    if (!failed) return "none";
    return queued ? "queued" : "failed";
}

/**
 * Whether a message sent again takes its copy's place, now that it's about to (it may have waited,
 * on the rules, say): only if the copy is still where it was when the send started. Gone, another
 * send of it has taken it; queued since, the offline queue owns it. Either way this send would add
 * a second copy. A message that wasn't kept anywhere is sent as before.
 */
export function resendTakesCopy(atStart: FailedCopy, now: FailedCopy): boolean {
    return atStart === "none" || atStart === now;
}

/**
 * Whether the message a send refused for the rules is sent again once they're accepted: only while
 * it's shown failed. Sent again meanwhile (Retry), or queued for the connection (the queue sends it
 * itself), it's left as it is.
 */
export function resendsRefusedMessage(copy: FailedCopy): boolean {
    return copy === "failed";
}

/**
 * Whether a message sent again keeps the failed (and queued) messages written after it below it,
 * re-placing and retiming them (`reorderAfterResent`, `keptAfterResent`): the new UIs' resends
 * (`prompt`, `asked`) do. The old UIs' Retry (`fail`) leaves them as they were.
 */
export function keepsLaterMessagesBelow(mode: RulesRefusedSend): boolean {
    return mode !== "fail";
}
