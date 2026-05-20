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
