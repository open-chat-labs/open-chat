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

// A swap the user started straight from their own wallet (as a user who holds their own funds) which
// was never marked as completed, eg. because they left part way through
export type UnfinishedTokenSwap = {
    swapId: bigint;
    started: bigint;
    inputLedger: string;
    outputLedger: string;
    exchangeArgs: ExchangeTokenSwapArgs;
};

// The outcome of a swap made straight from the user's wallet, where the DEX pulls the input via
// ICRC2 and sends the output back to the wallet. `amountOut` is what the DEX sends to the wallet.
// An error means nothing was swapped; each DEX's client says what becomes of the input.
export type DexSwapResult =
    | { kind: "success"; amountOut: bigint }
    | { kind: "error"; error: string };
