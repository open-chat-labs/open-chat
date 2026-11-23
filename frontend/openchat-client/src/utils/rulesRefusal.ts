import { ErrorCode, type RulesRefusedSend, type SendMessageResponse } from "@shared";

/** Whose rules a send was refused for not having accepted: the chat's or its community's. */
export type RulesRefusal = "chat" | "community";

/** Whose rules the send was refused for, if it was refused for the rules. */
export function rulesRefusal(resp: SendMessageResponse): RulesRefusal | undefined {
    if (resp.kind !== "error") return undefined;
    switch (resp.code) {
        case ErrorCode.ChatRulesNotAccepted:
            return "chat";
        case ErrorCode.CommunityRulesNotAccepted:
            return "community";
        default:
            return undefined;
    }
}

/**
 * Whether a send refused for the rules asks the user to accept them and sends again: only if the
 * caller asked for that, and only a message that can be sent again from where it failed (one that
 * can't, a payment, fails as before).
 */
export function promptsForRefusedRules(
    mode: RulesRefusedSend,
    refusal: RulesRefusal | undefined,
    canRetry: boolean,
): boolean {
    return mode === "prompt" && refusal !== undefined && canRetry;
}

/**
 * Whether a message the chat refused for the rules is sent again by itself once the user accepts
 * them on another send in the chat, the cause being gone: only in the new UIs (`prompt`, `asked`).
 * The old UIs (`fail`) leave it for Retry.
 */
export function resendsOnceRulesAccepted(mode: RulesRefusedSend): boolean {
    return mode !== "fail";
}

/**
 * Which of the chat's messages refused for the rules to send again next, once they're accepted: the
 * oldest written (then the lowest index) of those still failed that this run hasn't sent yet.
 */
export function nextRulesRefusedResend<
    T extends { messageId: bigint; timestamp: bigint; index: number },
>(failed: readonly T[], sent: ReadonlySet<bigint>): T | undefined {
    let next: T | undefined;
    for (const m of failed) {
        if (sent.has(m.messageId)) continue;
        if (
            next === undefined ||
            m.timestamp < next.timestamp ||
            (m.timestamp === next.timestamp && m.index < next.index)
        ) {
            next = m;
        }
    }
    return next;
}
