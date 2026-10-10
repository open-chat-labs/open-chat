import { ErrorCode, type SwapFromWalletStep, type SwapTokensResponse } from "@client";

export type SwapOutcome = "success" | "rateChanged" | "insufficientFunds" | "unknown" | "error";

// The steps of a swap the user makes straight from their wallet, in order. The swap is initialised
// (recorded by the user's canister, which checks their PIN) before any of the steps it reports. The
// withdrawal only happens if the DEX doesn't pay out the output itself in good time.
export type WalletSwapStep = "init" | SwapFromWalletStep;

const WALLET_SWAP_STEPS: WalletSwapStep[] = ["init", "approve", "swap", "withdraw"];

// The steps of a swap made from the wallet so far, ending with `current`
export function walletSwapStepsUpTo(current: WalletSwapStep): WalletSwapStep[] {
    return WALLET_SWAP_STEPS.slice(0, WALLET_SWAP_STEPS.indexOf(current) + 1);
}

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
