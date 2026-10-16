import type { InterpolationValues, ResourceKey } from "../../utils/i18n";

export type DexId = "icpswap" | "taco";

export type TokenSwapPool = {
    dex: DexId;
    canisterId: string;
    token0: string;
    token1: string;
};

// ICPSwap takes a (swap_canister_id, zero_for_one) pair because each pool is a
// distinct canister with a fixed token0/token1 ordering. TACO routes through a
// single exchange canister that does its own multi-hop / split routing, so it
// needs the exchange canister id plus the separate treasury canister id that
// receives the user's ICRC1 deposit before each swap.
export type ExchangeTokenSwapArgs =
    | { dex: "icpswap"; swapCanisterId: string; zeroForOne: boolean }
    | { dex: "taco"; swapCanisterId: string; treasuryCanisterId: string };

// A swap the user started straight from their own wallet which was never marked as completed, eg.
// because they left part way through
export type UnfinishedTokenSwap = {
    swapId: bigint;
    started: bigint;
    inputLedger: string;
    outputLedger: string;
    exchangeArgs: ExchangeTokenSwapArgs;
};

// The outcome of a swap made straight from the user's wallet, where the DEX pulls the input via
// ICRC2 and sends the output back to the wallet. `amountOut` is what the DEX sends to the wallet.
// An error means nothing was swapped, `rateChanged` being whether the DEX refused the swap since
// the rate had moved too far since the quote; each DEX's client says what becomes of the input.
// After an `unconfirmed` error the swap may or may not have gone ahead.
export type DexSwapResult =
    | { kind: "success"; amountOut: bigint }
    | { kind: "error"; error: string; rateChanged: boolean }
    | { kind: "unconfirmed"; error: string };

/**
 * The best quote for swapping `amountIn` of one token in the user's wallet for another. `amountIn` is
 * what leaves the wallet, fees included. `valueWarning` is set when the quote is worth less than 90%
 * of what goes in, or when either token's dollar price is unknown, and the user has to confirm it
 * before swapping. `values` fill in the messages that describe the quote.
 */
export type SwapQuote = {
    ledgerIn: string;
    ledgerOut: string;
    dex: DexId;
    amountIn: bigint;
    amountOut: bigint;
    valueWarning: "dropped" | "unknown" | undefined;
    values: NonNullable<InterpolationValues>;
};

export type SwapQuoteOutcome =
    | { kind: "quoted"; quote: SwapQuote }
    | { kind: "failed"; message: ResourceKey };

/**
 * How a swap from the wallet went. `cancelled` means the user dismissed the PIN prompt, so nothing was
 * sent. The user can quote again after `rate_changed`, and change the amount after `insufficient_funds`.
 */
export type SwapOutcome =
    | { kind: "swapped"; amountOut: bigint }
    | { kind: "cancelled" }
    | { kind: "rate_changed"; message: ResourceKey }
    | { kind: "insufficient_funds"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey };
