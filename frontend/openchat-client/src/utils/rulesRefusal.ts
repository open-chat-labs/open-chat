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
