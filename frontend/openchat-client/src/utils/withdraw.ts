import {
    i18nKey,
    type WithdrawBtcResponse,
    type WithdrawCryptocurrencyResponse,
    type WithdrawOutcome,
} from "@shared";

export function withdrawFailed(symbol: string): WithdrawOutcome {
    return { kind: "failed", message: i18nKey("cryptoAccount.sendFailed", { symbol }) };
}

export function withdrawResult(
    resp: WithdrawCryptocurrencyResponse | WithdrawBtcResponse,
    symbol: string,
): WithdrawOutcome {
    switch (resp.kind) {
        case "completed":
        case "success":
            return { kind: "sent" };
        case "failed":
        case "error":
        case "offline":
            return withdrawFailed(symbol);
        default:
            return resp satisfies never;
    }
}
