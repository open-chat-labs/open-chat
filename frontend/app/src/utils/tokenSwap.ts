import { ErrorCode, type SwapTokensResponse } from "@client";

export type SwapOutcome = "success" | "rateChanged" | "insufficientFunds" | "unknown" | "error";

// How a swap the user made straight from their wallet ended, from what swapping returned, since
// there is no progress to follow for one
export function swapFromWalletOutcome(response: SwapTokensResponse): SwapOutcome {
    if (response.kind === "success") return "success";
    if (response.kind === "error") {
        switch (response.code) {
            case ErrorCode.InsufficientFunds:
                return "insufficientFunds";
            // The DEX refused the swap since the rate had moved too far since the quote
            case ErrorCode.SwapFailed:
                return "rateChanged";
            // The call to the DEX failed, so the swap may or may not have gone ahead
            case ErrorCode.Unknown:
                return "unknown";
        }
    }
    return "error";
}
