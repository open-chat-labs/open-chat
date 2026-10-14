import {
    i18nKey,
    pinNumberFailureFromError,
    type Message,
    type TipMessageResponse,
    type TipOutcome,
} from "@shared";

// What the user has already tipped the message in the ledger's token
export function currentTip(message: Message, ledger: string, userId: string): bigint {
    return (message.tips[ledger] ?? {})[userId] ?? 0n;
}

export function tipResult(resp: TipMessageResponse): TipOutcome {
    switch (resp.kind) {
        case "success":
            return { kind: "tipped" };
        case "error":
            return pinNumberFailureFromError(resp) !== undefined
                ? { kind: "pin_failed" }
                : { kind: "failed", message: i18nKey("tip.failure") };
        case "failure":
            return { kind: "failed", message: i18nKey("tip.failure") };
        default:
            return resp satisfies never;
    }
}
