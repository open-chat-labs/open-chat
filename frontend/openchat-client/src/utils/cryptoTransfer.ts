import {
    i18nKey,
    pinNumberFailureFromError,
    type CryptoTransferOutcome,
    type SendMessageResponse,
} from "@shared";

export function cryptoTransferResult(resp: SendMessageResponse): CryptoTransferOutcome {
    if (resp.kind === "success" || resp.kind === "transfer_success") {
        return { kind: "sent" };
    }
    if (resp.kind === "error" && pinNumberFailureFromError(resp) !== undefined) {
        return { kind: "pin_failed" };
    }
    return { kind: "failed", message: i18nKey("errorSendingMessage") };
}
