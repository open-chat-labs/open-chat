import { ErrorCode, type SwapTokensResponse } from "@client";

export type SwapOutcome = "success" | "rateChanged" | "insufficientFunds" | "error";

// How a swap the user made straight from their wallet ended, from what swapping returned, since
// there is no progress to follow for one
export function swapFromWalletOutcome(response: SwapTokensResponse): SwapOutcome {
    if (response.kind === "success") return "success";
    if (response.kind === "error") {
        if (response.code === ErrorCode.InsufficientFunds) return "insufficientFunds";
        // The DEX refused the swap, which is usually because the rate has moved
        if (response.code === ErrorCode.SwapFailed) return "rateChanged";
    }
    return "error";
}
