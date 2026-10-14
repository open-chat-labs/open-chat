import type { SwapFromWalletStep } from "@client";

// The steps of a swap the user makes straight from their wallet, in order. The swap is initialised
// (recorded by the user's canister, which checks their PIN) before any of the steps it reports. The
// withdrawal is the DEX paying the output to the wallet, so only follows a swap which went ahead.
export type WalletSwapStep = "init" | SwapFromWalletStep["step"];

const WALLET_SWAP_STEPS: WalletSwapStep[] = ["init", "approve", "swap", "withdraw"];

// The steps of a swap made from the wallet so far, ending with `current`
export function walletSwapStepsUpTo(current: WalletSwapStep): WalletSwapStep[] {
    return WALLET_SWAP_STEPS.slice(0, WALLET_SWAP_STEPS.indexOf(current) + 1);
}
