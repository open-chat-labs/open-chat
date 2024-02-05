export type DexId = "icpswap";

export type TokenSwapPool = {
    dex: DexId;
    canisterId: string;
    token0: string;
    token1: string;
};

export type ExchangeTokenSwapArgs = {
    dex: "icpswap";
    swapCanisterId: string;
    zeroForOne: boolean;
};