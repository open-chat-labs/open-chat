export type DexId = "icpswap" | "kongswap" | "sonic";

export type TokenSwapPool = {
    dex: DexId;
    canisterId: string;
    token0: string;
    token1: string;
};

export type ExchangeTokenSwapArgs = {
    dex: DexId;
    swapCanisterId: string;
    zeroForOne: boolean;
};
